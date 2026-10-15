import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * 应用根模块
 *
 * 模块划分遵循"按业务域分包"：
 *   modules/   业务模块（health / auth / system / product / order / user / dashboard）
 *   common/    跨模块基础设施（异常、拦截器、装饰器、DTO）
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
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
