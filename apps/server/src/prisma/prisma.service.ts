import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Prisma 服务
 *
 * Prisma 7 的变化：datasource 里不再有 url，运行时连接靠 driver adapter。
 * 所以这里必须显式构造一个 PrismaMariaDb 适配器传给 PrismaClient，
 * 否则会报 "client engine requires adapter or accelerateUrl"。
 *
 * 为什么用继承而不是组合：
 *   继承后可以在业务里直接注入 PrismaService 并调用 prisma.sysAdmin.findMany()，
 *   这是 NestJS + Prisma 的惯用法，类型提示也最完整。
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      adapter: new PrismaMariaDb({
        host: process.env.DATABASE_HOST ?? '127.0.0.1',
        port: Number(process.env.DATABASE_PORT ?? 3306),
        user: process.env.DATABASE_USER ?? 'root',
        password: process.env.DATABASE_PASSWORD ?? '',
        database: process.env.DATABASE_NAME ?? 'mall_admin',
        // 连接池大小：后台管理系统并发不高，10 条足够
        connectionLimit: Number(process.env.DATABASE_POOL_SIZE ?? 10),
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log(
      `Prisma 已连接 ${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma 连接已释放');
  }

  /**
   * 轻量连通性探测，供健康检查接口使用。
   * 不用 $connect（它只在启动时调一次），而是发一条最便宜的查询。
   */
  async ping(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (e) {
      this.logger.error(`数据库连通性探测失败: ${(e as Error).message}`);
      return false;
    }
  }
}
