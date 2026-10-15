import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WILDCARD_PERMISSION } from '@mall-admin/shared';
import type { Request } from 'express';
import { ErrorCode } from '../constants/error-code';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { BizException } from '../exceptions/biz.exception';
import { PermissionService } from '../permission/permission.service';
import type { JwtPayload } from '../types/auth';

/**
 * 权限守卫（授权）
 *
 * 与 JwtAuthGuard（认证）的分工：
 *   认证 = 你是谁         → JwtAuthGuard
 *   授权 = 你能做什么     → PermissionGuard（这个）
 *
 * 两者**必须按顺序执行**：授权要读认证挂上去的 request.user。
 * 所以它们在 AppModule 的 providers 数组里按顺序注册，
 * 并且下面有一处防御性检查兜底（详见 canActivate 里的注释）。
 *
 * ============================================================================
 *  「后端必须真的校验权限」
 * ============================================================================
 *  前端靠 v-permission 隐藏按钮只是**体验优化**，不是安全措施 ——
 *  任何人都能直接调接口。权限的唯一有效落点在后端，
 *  而这里就是那个落点。所有涉及写操作的接口都必须声明权限码。
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // getAllAndOverride 会依次查 handler 与 class，方法上的声明优先于控制器上的
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 没声明权限码 = 只要求登录（认证已经由 JwtAuthGuard 把关）
    if (!required || required.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const user = request.user;

    /**
     * ★ 防御性检查：失败关闭（fail closed）
     *
     *   正常流程下 JwtAuthGuard 一定先跑并把 user 挂上。
     *   但如果有人调整了 AppModule 里守卫的注册顺序，
     *   或者给某个接口单独加了 @UseGuards(PermissionGuard)，
     *   这里就可能拿到 undefined。
     *
     *   此时**必须拒绝**而不是放行。放行的话，权限校验会静默失效，
     *   而且因为接口一切正常，没有任何迹象表明出了问题 ——
     *   这是最危险的一类 bug。
     */
    if (!user) {
      throw new BizException(ErrorCode.UNAUTHORIZED, '未登录，请先登录');
    }

    const { permissions } = await this.permissionService.load(BigInt(user.sub));

    // 超级管理员拿的是通配符，直接放行
    if (permissions.includes(WILDCARD_PERMISSION)) {
      return true;
    }

    // 多个权限码之间是「或」：任意一个满足即可
    const allowed = required.some((code) => permissions.includes(code));

    if (!allowed) {
      // 把需要的权限码告诉用户：这是内部管理系统，
      // 使用者是同事而不是攻击者，说清"缺哪个权限"能省掉大量沟通成本。
      // 如果是面向公众的产品，这里应该只返回笼统的"无权限"。
      throw new BizException(
        ErrorCode.FORBIDDEN,
        `没有该操作权限（需要 ${required.join(' 或 ')}）`,
      );
    }

    return true;
  }
}
