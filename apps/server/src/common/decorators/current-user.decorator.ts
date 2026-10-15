import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from '../types/auth';

/**
 * 注入当前登录人
 *
 * 用法：
 *   getProfile(@CurrentUser() user: JwtPayload) {}          // 拿整个载荷
 *   getProfile(@CurrentUser('sub') adminId: string) {}      // 只拿某个字段
 *
 * ★ 为什么用装饰器而不是让控制器自己去读 req.user
 *   控制器直接依赖 req 的形状，等于把"守卫往 request 上挂了什么"
 *   这个实现细节泄漏到了业务代码里。
 *   换一种认证方式（比如换成 session）就得改所有控制器。
 *   用装饰器后，业务代码只依赖"我能拿到当前登录人"这个契约。
 *
 * 前提：JwtAuthGuard 必须已经把载荷挂到 request.user 上。
 * 如果接口标了 @Public()，守卫不会执行，这里的 user 就是 undefined ——
 * 所以公开接口不要用这个装饰器。
 */
export const CurrentUser = createParamDecorator(
  (field: keyof JwtPayload | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const user = request.user;

    return field ? user?.[field] : user;
  },
);
