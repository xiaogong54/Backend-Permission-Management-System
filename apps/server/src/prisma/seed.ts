import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../generated/prisma/client';
import {
  PERMISSIONS,
  ROLE_GRANTS,
  type PermissionSeed,
} from './seed-data/permissions';

/**
 * 数据库种子脚本
 *
 * 运行方式：
 *   pnpm --filter @mall-admin/server db:seed
 * 或在 prisma migrate reset 之后自动执行（配置在 prisma7.config.ts 的 migrations.seed）
 *
 * ============================================================================
 *  四条设计原则
 * ============================================================================
 *
 * 1. 密码绝不硬编码哈希
 *    bcrypt.hash() 在运行时生成，明文从环境变量读。
 *    硬编码哈希的问题：一旦这个仓库被 fork、被分享，那个哈希就永久留在 Git 历史里，
 *    而且它对应的是一个真实可用的口令。运行时生成的代价只是慢几十毫秒。
 *
 * 2. 必须幂等
 *    seed 会被反复执行（migrate reset 后、换机器、CI 里）。
 *    不幂等的话第二次跑就报唯一键冲突，还得手动清库。
 *
 * 3. 不用 upsert，用 findFirst + create/update（针对带软删除的表）
 *    原因见下面 upsertRole 的注释 —— 这条和软删除设计直接相关。
 *
 * 4. 数据里的错别字必须报错，不能静默跳过
 *    权限码写错一个字母，如果只是"查不到就跳过"，结果是那个按钮永远没权限，
 *    而且没有任何报错。见 grantRole 里对缺失 code 的处理。
 */

/** BCrypt 成本因子。10 ≈ 单次约 100ms，是安全性与登录延迟的常用平衡点 */
const BCRYPT_ROUNDS = 10;

/**
 * 初始管理员的账号与口令
 * 默认值只用于本地开发。生产环境务必通过环境变量覆盖，
 * 并提醒使用者首次登录后立刻改密（sys_admin.pwd_updated_at 就是为此预留的）。
 */
const ADMIN_USERNAME = process.env.INIT_ADMIN_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.INIT_ADMIN_PASSWORD ?? 'Admin@123456';

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER ?? 'root',
    password: process.env.DATABASE_PASSWORD ?? '',
    database: process.env.DATABASE_NAME ?? 'mall_admin',
    connectionLimit: 1,
  }),
});

/** 三个内置角色，与 docs/设计概览.md 一致 */
const ROLES = [
  {
    code: 'SUPER_ADMIN',
    name: '超级管理员',
    description: '拥有系统全部权限，可管理账号、角色与权限配置',
    sort: 1,
  },
  {
    code: 'OPERATOR',
    name: '运营管理员',
    description: '负责商品维护、订单处理与用户管理，无系统配置权限',
    sort: 2,
  },
  {
    code: 'DATA_ADMIN',
    name: '数据管理员',
    description: '仅可查看数据看板与业务列表，可导出报表，无任何写权限',
    sort: 3,
  },
] as const;

// ============================================================================
//  权限树
// ============================================================================

/**
 * 幂等地写入权限树
 *
 * @returns 权限码 → 权限 id 的映射，供后续授权使用
 */
async function seedPermissions(): Promise<Map<string, bigint>> {
  const codeToId = new Map<string, bigint>();

  for (const p of PERMISSIONS) {
    const data = toPermissionData(p);

    // 按固定 id upsert：PERMISSIONS 里每个节点的 id 都是显式写死的，
    // 所以这个 where 条件是稳定的，重复执行不会产生重复行。
    await prisma.sysPermission.upsert({
      where: { id: BigInt(p.id) },
      update: data,
      create: { id: BigInt(p.id), ...data },
    });

    if (p.code !== null) {
      codeToId.set(p.code, BigInt(p.id));
    }
  }

  // 顺带做一次一致性自检：id 与 code 都不能重复，
  // 重复了说明数据表里写错了，这种错误必须在 seed 阶段就炸出来
  const ids = PERMISSIONS.map((p) => p.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error('权限树里存在重复的 id');
  }
  const codes = PERMISSIONS.map((p) => p.code).filter(
    (c): c is string => c !== null,
  );
  if (new Set(codes).size !== codes.length) {
    throw new Error('权限树里存在重复的 code');
  }

  const dirCount = PERMISSIONS.filter((p) => p.type === 1).length;
  const menuCount = PERMISSIONS.filter((p) => p.type === 2).length;
  const btnCount = PERMISSIONS.filter((p) => p.type === 3).length;
  const apiCount = PERMISSIONS.filter((p) => p.type === 4).length;
  console.log(
    `  · 权限节点 ${PERMISSIONS.length} 个（目录 ${dirCount} / 菜单 ${menuCount} / 按钮 ${btnCount} / 接口 ${apiCount}）`,
  );

  return codeToId;
}

function toPermissionData(p: PermissionSeed) {
  return {
    parentId: BigInt(p.parentId),
    name: p.name,
    type: p.type,
    code: p.code,
    routePath: p.routePath,
    routeName: p.routeName,
    component: p.component,
    icon: p.icon,
    sort: p.sort,
    visible: p.visible,
    keepAlive: p.keepAlive,
    httpMethod: p.httpMethod,
    apiPath: p.apiPath,
    status: 1,
  };
}

// ============================================================================
//  角色
// ============================================================================

/**
 * 按 code 查角色，有则更新、无则创建
 *
 * ★ 为什么不用 prisma.sysRole.upsert({ where: { code } })
 *   因为我们的唯一约束是 @@unique([code, deletedAt]) 这个**联合唯一键**，
 *   不存在单独的 code 唯一键，upsert 的 where 条件写不出来。
 *
 * ★ 更本质的原因（这条才是关键）
 *   软删除方案里 deletedAt 对"活着的"记录是 NULL，
 *   而 MySQL 的联合唯一索引中多个 NULL 互不冲突 ——
 *   也就是说**数据库层面根本挡不住两条 code 相同的存活记录**。
 *   这正是设计文档里强调"业务层必须显式查重"的原因。
 *   这里的 findFirst + deletedAt: null 就是那个"显式查重"。
 */
async function upsertRole(input: {
  code: string;
  name: string;
  description: string;
  sort: number;
}): Promise<bigint> {
  const existing = await prisma.sysRole.findFirst({
    where: { code: input.code, deletedAt: null },
    select: { id: true },
  });

  const data = {
    name: input.name,
    description: input.description,
    sort: input.sort,
    isBuiltin: 1,
    status: 1,
  };

  if (existing) {
    await prisma.sysRole.update({ where: { id: existing.id }, data });
    return existing.id;
  }

  const created = await prisma.sysRole.create({
    data: { code: input.code, ...data },
    select: { id: true },
  });
  return created.id;
}

/**
 * 给角色授予权限（先清空再全量重建）
 *
 * ★ 为什么是"清空重建"而不是"增量对比"
 *   seed 的语义是**把数据重置到已知状态**，不是"尽量少改动"。
 *   清空重建让"改了下面的授权列表 → 重跑 seed → 生效"这条路直接可用，
 *   不需要手动去数据库里删旧记录。
 *   增量对比要写增/删/留三套逻辑，代码量翻几倍，换来的只是少删几行数据。
 *
 * ★ 权限码写错必须报错
 *   如果只是"查不到就跳过"，写错一个字母的结果是那个按钮永远没权限，
 *   而且没有任何报错 —— 排查起来要从前端一路查到数据库。
 *   seed 数据是人手写的，最容易出的就是拼写错误，所以这里直接抛异常。
 */
async function grantRole(
  roleCode: string,
  roleId: bigint,
  codes: string[],
  codeToId: Map<string, bigint>,
): Promise<void> {
  const missing = codes.filter((c) => !codeToId.has(c));
  if (missing.length > 0) {
    throw new Error(
      `角色 ${roleCode} 的授权列表里出现了未定义的权限码：\n    ${missing.join('\n    ')}\n` +
        '  请检查 seed-data/permissions.ts 里的拼写。',
    );
  }

  await prisma.sysRolePermission.deleteMany({ where: { roleId } });

  if (codes.length > 0) {
    await prisma.sysRolePermission.createMany({
      data: codes.map((code) => ({
        roleId,
        // 上面已经用 missing 检查保证了一定能取到，这里的断言是安全的
        permissionId: codeToId.get(code) as bigint,
      })),
    });
  }

  console.log(`  · ${roleCode} 授权 ${codes.length} 项`);
}

// ============================================================================
//  管理员
// ============================================================================

/** 同上：先按 username 查重，再决定更新还是创建 */
async function upsertAdmin(): Promise<bigint> {
  // ★ 每次执行都重新生成哈希：盐是随机的，所以两次生成的哈希必然不同。
  //   这意味着反复跑 seed 会把已改过的密码**重置回默认值** ——
  //   本地开发无所谓，生产环境不要跑这个脚本。
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);

  const existing = await prisma.sysAdmin.findFirst({
    where: { username: ADMIN_USERNAME, deletedAt: null },
    select: { id: true },
  });

  const data = {
    password: passwordHash,
    nickname: '超级管理员',
    email: 'admin@mall-admin.dev',
    status: 1,
    isBuiltin: 1,
    remark: '内置超级管理员，禁止删除与禁用',
  };

  if (existing) {
    await prisma.sysAdmin.update({ where: { id: existing.id }, data });
    console.log(`  · 管理员已存在，密码已重置：${ADMIN_USERNAME}`);
    return existing.id;
  }

  const created = await prisma.sysAdmin.create({
    data: { username: ADMIN_USERNAME, ...data },
    select: { id: true },
  });
  console.log(`  · 管理员已创建：${ADMIN_USERNAME}`);
  return created.id;
}

/** 绑定管理员与角色。中间表没有软删除，用联合唯一键做存在性判断即可 */
async function linkAdminRole(adminId: bigint, roleId: bigint): Promise<void> {
  const existing = await prisma.sysAdminRole.findFirst({
    where: { adminId, roleId },
    select: { id: true },
  });

  if (existing) {
    console.log('  · 管理员与角色的关联已存在，跳过');
    return;
  }

  await prisma.sysAdminRole.create({ data: { adminId, roleId } });
  console.log('  · 已绑定超级管理员角色');
}

// ============================================================================
//  主流程
// ============================================================================

async function main(): Promise<void> {
  console.log('');
  console.log('=== 开始灌入种子数据 ===');

  const target = `${process.env.DATABASE_HOST ?? '127.0.0.1'}:${process.env.DATABASE_PORT ?? 3306}/${process.env.DATABASE_NAME ?? 'mall_admin'}`;
  console.log(`  目标数据库：${target}`);
  console.log('');

  console.log('[1/4] 权限树');
  const codeToId = await seedPermissions();

  console.log('');
  console.log('[2/4] 角色');
  const roleIds = new Map<string, bigint>();
  for (const role of ROLES) {
    roleIds.set(role.code, await upsertRole(role));
    console.log(`  · 角色已就绪：${role.code}`);
  }

  console.log('');
  console.log('[3/4] 管理员');
  const adminId = await upsertAdmin();

  console.log('');
  console.log('[4/4] 授权与关联');

  // 超级管理员不落授权表：它走通配符 '*'，避免了"新增权限点要回头补授权"的问题
  console.log('  · SUPER_ADMIN 走通配符权限，不落授权表');
  await prisma.sysRolePermission.deleteMany({
    where: { roleId: roleIds.get('SUPER_ADMIN') as bigint },
  });

  for (const [roleCode, codes] of Object.entries(ROLE_GRANTS)) {
    const roleId = roleIds.get(roleCode);
    if (roleId === undefined) {
      throw new Error(`ROLE_GRANTS 里的角色 ${roleCode} 不在 ROLES 列表里`);
    }
    await grantRole(roleCode, roleId, codes, codeToId);
  }

  await linkAdminRole(adminId, roleIds.get('SUPER_ADMIN') as bigint);

  console.log('');
  console.log('=== 种子数据完成 ===');
  console.log('');
  console.log('  登录账号：' + ADMIN_USERNAME);
  console.log('  登录口令：' + ADMIN_PASSWORD);
  console.log('  ⚠️  这是本地开发用的默认口令，首次登录后请立即修改');
  console.log('');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    // 显式 exit：Prisma 的连接池和 adapter 有时会让进程多停留一会儿
    process.exit(0);
  })
  .catch(async (e: unknown) => {
    console.error('');
    console.error('=== 种子数据失败 ===');
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
