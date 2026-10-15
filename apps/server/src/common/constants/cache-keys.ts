/**
 * 缓存键统一定义
 *
 * ★ 为什么要集中在一处
 *   这些键会被**不同层**读写，例如：
 *     · auth.service 写入验证码、写入登出黑名单
 *     · jwt-auth.guard 读取黑名单做校验
 *   如果两边各写一遍字符串前缀，某天有人改了其中一处，就会变成
 *   "登出后 token 依然有效" —— 而且不会有任何报错，测试也未必覆盖得到。
 *
 *   集中定义后，改名是编译期错误，不是线上事故。
 */
export const AUTH_CACHE = {
  /**
   * 图形验证码：captchaId -> 答案（小写）
   * 用 take() 一次性消费，防重放
   */
  captcha: (captchaId: string): string => `auth:captcha:${captchaId}`,

  /**
   * 已登出的 token 黑名单：jti -> 1
   *
   * 为什么需要它：JWT 是**无状态**的，签发后在过期前一直有效，
   * 服务端没有任何办法"收回"。用户点了退出登录，token 却还能用 2 小时 ——
   * 这在共享设备或 token 泄露场景下是真实风险。
   *
   * 主流解法就是黑名单：登出时把该 token 的唯一标识（jti）记下来，
   * 每次验签后再查一次。代价是引入了一次缓存查询，
   * 这就是"无状态"换来的便利所必须付的账。
   *
   * TTL 设为该 token 的剩余有效期 —— 过期之后 JWT 自己就失效了，
   * 黑名单条目没有继续保留的意义，自动清理掉最省内存。
   */
  tokenBlacklist: (jti: string): string => `auth:token:blacklist:${jti}`,
} as const;
