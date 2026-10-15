import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Prisma 模块
 *
 * 用 @Global() 的理由：数据库访问几乎每个业务模块都要用，
 * 每个模块都 import 一遍 PrismaModule 是纯噪音。声明为全局后，
 * 只需在 AppModule 里 import 一次，其它模块直接注入 PrismaService。
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
