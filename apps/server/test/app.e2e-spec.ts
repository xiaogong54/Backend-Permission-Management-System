import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/** /health 的响应结构 */
interface HealthBody {
  status: 'up' | 'degraded';
  uptime: number;
  timestamp: string;
  database: 'up' | 'down';
}

/**
 * 端到端测试
 *
 * 覆盖两件事：
 *   1. 应用能真正启动（Prisma 能连上数据库、模块依赖能解析）
 *   2. 健康检查接口可用
 *
 * 注意：这个测试需要本机 MySQL 正在运行，并且 .env 里的连接串正确。
 * 启动方式：pnpm run test:e2e
 */
describe('健康检查 (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health 返回服务与数据库状态', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    // supertest 的 body 是 any，先断言成具体类型，后面才能安全取字段
    const body = res.body as HealthBody;

    expect(body.status).toBeDefined();
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    // 本机开发环境下数据库必须是通的，否则说明 .env 或 MySQL 有问题
    expect(body.database).toBe('up');
  });
});
