import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 标记接口为「无需登录」
 *
 * 默认策略是「全局要求登录」（守卫在 AppModule 里全局注册），
 * 需要开放的接口（登录、验证码、健康检查）显式打上 @Public()。
 *
 * 为什么用"默认拒绝"而不是"默认放行"：
 *   默认放行的话，新增接口一旦忘记加守卫就会裸奔；
 *   默认拒绝的话，忘记加 @Public() 只会导致 401，是安全的一侧。
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
