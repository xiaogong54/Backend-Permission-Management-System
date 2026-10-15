import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from './common/cache/cache.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * 应用根模块
 *
 * 模块划分遵循"按业务域分包"：
 *   modules/   业务模块（health / auth / system / product / order / user / dashboard）
 *   common/    跨模块基础设施（异常、过滤器、拦截器、守卫、装饰器、DTO、缓存）
 *   prisma/    数据访问层
 *   config/    配置
 *
 * 注意：不要把后续所有 controller 都堆进 AppModule，
 * 业务一多就会变成上千行的"上帝模块"，改一处要重新理解全貌。
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // prisma7.config.ts 也读同一个 .env，这里保持路径一致
      envFilePath: ['.env'],
      cache: true,
    }),
    // 基础设施（都声明了 @Global）
    CacheModule,
    PrismaModule,
    // 业务模块
    AuthModule,
    HealthModule,
  ],
  providers: [
    /**
     * 全局守卫：所有接口默认要求登录
     *
     * ★ 用 APP_GUARD 注册而不是 app.useGlobalGuards() 的原因
     *   useGlobalGuards 在 main.ts 里 new 出来的守卫**不在 Nest 容器里**，
     *   没法注入 Reflector / JwtService / CacheService 这些依赖 ——
     *   而我们的守卫三样都要用。
     *   APP_GUARD 注册的守卫由容器创建，依赖注入正常工作。
     *
     *   顺带的副作用（是好事）：e2e 测试只要 import AppModule 就自带守卫，
     *   不需要在 setup-app 里再补一遍，测试与线上行为自动一致。
     */
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
