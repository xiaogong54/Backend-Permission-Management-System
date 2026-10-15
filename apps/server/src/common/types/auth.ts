/**
 * 认证相关的公共类型
 *
 * ★ 为什么放在 common/ 而不是 modules/auth/
 *   这个类型会被三个地方用到：
 *     · modules/auth/auth.service.ts      签发 token 时构造它
 *     · common/guards/jwt-auth.guard.ts   验签后得到它
 *     · common/decorators/current-user.decorator.ts  注入它
 *     · common/guards/permission.guard.ts 读取它
 *
 *   如果定义留在 modules/auth/，那 common/ 就得反过来 import modules/ ——
 *   依赖方向反了。分层项目里 **modules → common 是允许的，反过来不是**，
 *   否则 common 就不再"公共"，而成了 modules 的下游。
 *   把它下沉到 common/types 后，所有依赖都指向同一个方向。
 */

/**
 * JWT 载荷
 *
 * jti / iat / exp 由 jsonwebtoken 自动写入，不需要手动填。
 * 但类型上必须声明，否则守卫与登出逻辑取不到它们。
 */
export interface JwtPayload {
  /** 管理员 id。按 JWT 规范 sub 必须是字符串 */
  sub: string;
  username: string;
  roles: string[];
  /** JWT ID —— 登出黑名单的抓手，签发时由 jwtid 选项写入 */
  jti?: string;
  /** 签发时间（秒级时间戳） */
  iat?: number;
  /** 过期时间（秒级时间戳） */
  exp?: number;
}
