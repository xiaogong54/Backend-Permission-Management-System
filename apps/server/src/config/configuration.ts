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
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  // 生产环境默认关闭 Swagger，避免接口文档暴露在外网
  swaggerEnabled:
    process.env.SWAGGER_ENABLED === 'true' ||
    (process.env.NODE_ENV ?? 'development') !== 'production',
});
