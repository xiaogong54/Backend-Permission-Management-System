import { Injectable } from '@nestjs/common';
import { RoleCode, WILDCARD_PERMISSION } from '@mall-admin/shared';
import { PrismaService } from '../../prisma/prisma.service';

/** 角色与权限的查询结果 */
export interface RolesAndPermissions {
  /** 有效角色的角色码 */
  roles: string[];
  /**
   * 权限码集合。
   * 超级管理员这里是 ['*'] —— 通配符，不是几十条权限逐条列出。
   */
  permissions: string[];
}

/**
 * 权限查询服务
 *
 * ============================================================================
 *  为什么它在 common/ 而不是 modules/auth/
 * ============================================================================
 *  它被 common/guards/permission.guard.ts 依赖。如果放在 modules/ 下，
 *  common 就得反过来依赖 modules，依赖方向是反的。
 *  放在 common 后，依赖方向统一为 modules → common。
 *
 * ============================================================================
 *  ★ 为什么现在「不」加缓存 —— 这是本文件最重要的一个决定
 * ============================================================================
 *  直觉上这里很该缓存：每个请求都要查权限，而权限几乎不变。
 *  但缓存不是免费的，它的成本是**失效策略**：
 *    · 缓存的失效路径（改角色、改权限、禁用角色）目前还没实现 ——
 *      那些写接口属于后面的"系统权限模块"。
 *    · 在失效路径缺失的情况下加缓存，等于制造一个"撤销了权限但五分钟内
 *      依然能操作"的窗口，而且没有任何测试能覆盖到。
 *
 *  而收益有多大？两条索引查询，实测在 1~2ms 量级，
 *  相对 PRD 里 500ms 的接口响应预算可以忽略。
 *
 *  所以结论是：**收益小、风险大，先不加。**
 *  等角色/权限的写接口做出来时，把"缓存 + 显式失效"作为一件事一起做，
 *  那时才有能力保证正确性。
 *
 *  没有失效策略的缓存不是优化，是 bug 制造机。这是很常见的踩坑点。
 */
@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 加载某管理员的角色码与权限码
   *
   * 两次查询：
   *   1. 管理员 → 角色
   *   2. 角色 → 权限码
   * 没有合并成一条大 JOIN，是因为第二步需要先过滤出"有效角色"再查权限，
   * 合并后 WHERE 条件会变得很难读，而且两次点查都走索引，差距可以忽略。
   */
  async load(adminId: bigint): Promise<RolesAndPermissions> {
    const links = await this.prisma.sysAdminRole.findMany({
      where: { adminId },
      select: {
        role: {
          select: { id: true, code: true, status: true, deletedAt: true },
        },
      },
    });

    // 只认启用且未软删的角色 —— 角色被停用后，它带来的权限必须立刻消失
    const activeRoles = links
      .map((l) => l.role)
      .filter((r) => r.status === 1 && r.deletedAt === null);

    const roles = activeRoles.map((r) => r.code);

    // ★ 超级管理员短路：直接给通配符，不再查权限表
    //   好处是后续新增权限点无需回头给超管补授权 ——
    //   这规避了 RBAC 系统最经典的事故："加了新功能，超管反而没权限"。
    if (roles.includes(RoleCode.SUPER_ADMIN)) {
      return { roles, permissions: [WILDCARD_PERMISSION] };
    }

    if (activeRoles.length === 0) {
      return { roles, permissions: [] };
    }

    const rows = await this.prisma.sysRolePermission.findMany({
      where: {
        roleId: { in: activeRoles.map((r) => r.id) },
        // 权限本身被停用时也不该生效
        permission: { status: 1, code: { not: null } },
      },
      select: { permission: { select: { code: true } } },
    });

    // 一个用户可能身兼多个角色，权限取并集，必须去重
    const permissions = [
      ...new Set(
        rows
          .map((r) => r.permission.code)
          .filter((code): code is string => code !== null && code !== ''),
      ),
    ];

    return { roles, permissions };
  }
}
