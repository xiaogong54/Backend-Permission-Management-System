import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from './common/cache/cache.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { PermissionModule } from './common/permission/permission.module';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * 应用根模块
 *
 * 模块划分遵循"按业务域分包"：
 *   modules/   业务模块（health / auth / system / product / order / user / dashboard）
 *   common/    跨模块基础设施（异常、过滤器、拦截器、守卫、装饰器、DTO、缓存、权限查询）
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
    PermissionModule,
    PrismaModule,
    // 业务模块
    AuthModule,
    HealthModule,
  ],
  providers: [
    /**
     * 全局守卫，**顺序有意义**
     *
     * ★ 为什么两个守卫必须放在同一个数组里、且按顺序排列
     *   认证在前、授权在后：PermissionGuard 要读 JwtAuthGuard
     *   挂到 request.user 上的载荷。顺序反了，权限校验会拿不到用户。
     *
     *   如果把其中一个挪到别的模块用 APP_GUARD 注册，
     *   两个守卫的先后就取决于 Nest 解析模块的顺序，不再受控 ——
     *   所以它们必须并排放在这里。
     *   （PermissionGuard 内部还有一处失败关闭的兜底检查，双保险。）
     *
     * ★ 为什么用 APP_GUARD 而不是 app.useGlobalGuards()
     *   useGlobalGuards 在 main.ts 里 new 出来的守卫**不在 Nest 容器里**，
     *   没法注入 Reflector / JwtService / CacheService / PermissionService ——
     *   而我们这两个守卫全都要用。
     *
     *   顺带的好处：e2e 测试只要 import AppModule 就自带守卫，
     *   不需要在 setup-app 里再补一遍，测试与线上行为自动一致。
     */
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
})
export class AppModule {}
