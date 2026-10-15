/**
 * 应用配置
 *
 * 用 @nestjs/config 的工厂函数形式，好处是：
 *   1. 环境变量只在启动时读一次并做类型转换，业务层拿到的就是正确类型
 *   2. 缺关键变量可以在启动阶段立刻报错，而不是运行到一半才炸
 *   3. 测试时可以整块替换
 */
export interface AppConfig {
  env: string;
  port: number;
  apiPrefix: string;
  swaggerEnabled: boolean;
  jwt: {
    secret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
  redis: {
    host: string;
    port: number;
    password: string;
    db: number;
  };
}

/** 已知的占位密钥，出现在生产环境属于严重安全事故 */
const PLACEHOLDER_SECRETS = new Set([
  'please-change-me-to-a-long-random-string',
  'change-me',
  'secret',
]);

export default (): AppConfig => {
  const env = process.env.NODE_ENV ?? 'development';
  const isProduction = env === 'production';

  const jwtSecret = process.env.JWT_SECRET ?? '';

  /**
   * 快速失败（fail fast）
   *
   * 为什么必须在启动阶段就拦：
   *   JWT 密钥是登录体系的根。如果它是空串或占位值还继续启动，
   *   服务能跑、接口能通、登录也"成功"，但任何人都能用已知密钥
   *   伪造出合法 token 冒充管理员 —— 而且日志里看不出任何异常。
   *   这种问题发现得越晚，代价越大。
   */
  if (!jwtSecret) {
    throw new Error(
      '缺少环境变量 JWT_SECRET。请复制 apps/server/.env.example 为 .env 并设置一个足够长的随机串。',
    );
  }
  if (isProduction && PLACEHOLDER_SECRETS.has(jwtSecret)) {
    throw new Error(
      '生产环境不能使用示例 JWT_SECRET，请替换为随机生成的长字符串。',
    );
  }

  return {
    env,
    port: Number(process.env.PORT ?? 3000),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    // 生产环境默认关闭 Swagger，避免接口文档暴露在外网
    swaggerEnabled: process.env.SWAGGER_ENABLED === 'true' || !isProduction,
    jwt: {
      secret: jwtSecret,
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '2h',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    },
    redis: {
      host: process.env.REDIS_HOST ?? '127.0.0.1',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD ?? '',
      db: Number(process.env.REDIS_DB ?? 0),
    },
  };
};
