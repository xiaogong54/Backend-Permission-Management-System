import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AUTH_CACHE } from '../constants/cache-keys';
import { ErrorCode } from '../constants/error-code';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { BizException } from '../exceptions/biz.exception';
import { CacheService } from '../cache/cache.service';
import type { JwtPayload } from '../../modules/auth/auth.service';

/**
 * JWT 认证守卫
 *
 * ============================================================================
 *  默认拒绝，而非默认放行
 * ============================================================================
 *  全局注册后，**所有接口默认都要求登录**，只有标了 @Public() 的才放行。
 *
 *  两种策略的失败方式完全不同：
 *    · 默认放行：新增接口时忘了加守卫 → 接口裸奔在公网上，而且没人会发现
 *    · 默认拒绝：新增接口时忘了加 @Public() → 401，本地一测就发现了
 *  出错时要往安全的那一侧倒。
 *
 * ============================================================================
 *  校验顺序：先验签，再查黑名单
 * ============================================================================
 *  验签是纯计算（快），查黑名单要走缓存（慢一个数量级）。
 *  顺序反过来，任何人都能用伪造的 token 去打缓存。
 *  这和登录接口"验证码 → 查库 → BCrypt"是同一个思路。
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly cache: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ---- 1. 公开接口直接放行 ----
    // getAllAndOverride 会依次查 handler 与 class，方法上的声明优先于控制器上的
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();

    // ---- 2. 取 token ----
    const token = this.extractToken(request);
    if (!token) {
      throw new BizException(ErrorCode.UNAUTHORIZED, '未登录，请先登录');
    }

    // ---- 3. 验签 ----
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch (e) {
      // 区分"过期"和"签名不对"，给前端不同的提示：
      // 过期 → 可以静默刷新或引导重新登录
      // 签名不对 → token 被篡改，属于异常情况
      const name = (e as Error).name;
      if (name === 'TokenExpiredError') {
        throw new BizException(ErrorCode.TOKEN_EXPIRED);
      }
      this.logger.warn(`token 验签失败: ${(e as Error).message}`);
      throw new BizException(
        ErrorCode.UNAUTHORIZED,
        '登录凭证无效，请重新登录',
      );
    }

    // ---- 4. 查黑名单（登出后的 token 在这里被拦下）----
    if (payload.jti) {
      const blacklisted = this.cache.get<number>(
        AUTH_CACHE.tokenBlacklist(payload.jti),
      );
      if (blacklisted) {
        throw new BizException(
          ErrorCode.UNAUTHORIZED,
          '登录状态已失效，请重新登录',
        );
      }
    }

    // ---- 5. 挂到 request 上，供 @CurrentUser() 使用 ----
    request.user = payload;

    return true;
  }

  /**
   * 从 Authorization 头里取 Bearer token
   *
   * 严格校验 scheme：不接受 "token xxx"、也不接受裸 token。
   * 宽松解析看着"兼容性好"，实际会让前端错误实现长期藏在水面下。
   */
  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) return null;

    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) return null;

    return value.trim() || null;
  }
}
