import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { CacheService } from './../src/common/cache/cache.service';
import { AUTH_CACHE } from './../src/common/constants/cache-keys';
import { RequirePermission } from './../src/common/decorators/require-permission.decorator';
import { PrismaService } from './../src/prisma/prisma.service';
import { configureApp } from './../src/setup-app';

const API = '/api/v1';
const LOGIN = `${API}/auth/login`;
const PROBE = `${API}/__probe__`;

/**
 * 权限探针控制器
 *
 * ★ 为什么不往 src/ 里加一个"演示接口"来测守卫
 *   生产代码里不该存在只为测试服务的接口 —— 它会永远留在那里，
 *   而且某天可能被真的调用到。
 *   把它定义在测试文件里，通过 TestingModule 的 controllers 挂进去，
 *   请求依然走**完整的守卫链**（JwtAuthGuard → PermissionGuard），
 *   测到的东西和真实接口完全一致，但应用本身保持干净。
 *
 *   真实业务接口的权限校验，会在各自的模块测试里覆盖。
 */
@Controller('__probe__')
class PermissionProbeController {
  /** 没声明权限码 = 只要求登录 */
  @Get('no-requirement')
  noRequirement(): { ok: boolean } {
    return { ok: true };
  }

  @Get('spu-list')
  @RequirePermission('product:spu:list')
  spuList(): { ok: boolean } {
    return { ok: true };
  }

  @Get('spu-create')
  @RequirePermission('product:spu:create')
  spuCreate(): { ok: boolean } {
    return { ok: true };
  }

  @Get('log-clear')
  @RequirePermission('system:log:clear')
  logClear(): { ok: boolean } {
    return { ok: true };
  }

  /** 多个权限码是「或」：任意一个满足即可 */
  @Get('either')
  @RequirePermission('system:log:clear', 'product:spu:create')
  either(): { ok: boolean } {
    return { ok: true };
  }
}

interface ApiBody<T> {
  code: number;
  message: string;
  data: T;
  traceId: string;
}

interface LoginData {
  token: string;
  roles: string[];
  permissions: string[];
}

/**
 * 权限守卫端到端测试
 *
 * ⚠️ 前置条件：数据库已迁移且已执行 seed
 */
describe('权限守卫 (e2e)', () => {
  let app: INestApplication<App>;
  let cache: CacheService;
  let prisma: PrismaService;

  /** 测试自己创建的账号，跑完会清理掉 */
  const PASSWORD = 'E2e@Test123456';
  const OPERATOR_NAME = 'e2e_operator';
  const DATA_ADMIN_NAME = 'e2e_data_admin';

  /** 登录并拿到 token */
  async function login(username: string, password: string): Promise<LoginData> {
    const captchaId = randomUUID();
    cache.set(AUTH_CACHE.captcha(captchaId), 'abcd', 120);

    const res = await request(app.getHttpServer())
      .post(LOGIN)
      .send({ username, password, captchaId, captcha: 'abcd' })
      .expect(200);

    return (res.body as ApiBody<LoginData>).data;
  }

  /** 带 token 请求探针接口 */
  function probe(token: string, path: string) {
    return request(app.getHttpServer())
      .get(`${PROBE}/${path}`)
      .set('Authorization', `Bearer ${token}`);
  }

  /** 清理测试账号及其角色关联 */
  async function deleteTestUsers(): Promise<void> {
    const admins = await prisma.sysAdmin.findMany({
      where: { username: { in: [OPERATOR_NAME, DATA_ADMIN_NAME] } },
      select: { id: true },
    });
    const ids = admins.map((a) => a.id);
    if (ids.length === 0) return;

    // 注意 relationMode = "prisma" 意味着没有真实外键约束，
    // 级联删除不会自动发生，必须按顺序手动删干净
    await prisma.sysAdminRole.deleteMany({ where: { adminId: { in: ids } } });
    await prisma.sysAdmin.deleteMany({ where: { id: { in: ids } } });
  }

  /** 创建测试账号并绑定指定角色 */
  async function createTestUser(
    username: string,
    roleCode: string,
  ): Promise<void> {
    const role = await prisma.sysRole.findFirst({
      where: { code: roleCode, deletedAt: null },
      select: { id: true },
    });
    if (!role) {
      throw new Error(
        `找不到角色 ${roleCode}，请先执行 pnpm --filter @mall-admin/server db:seed`,
      );
    }

    const admin = await prisma.sysAdmin.create({
      data: {
        username,
        password: await bcrypt.hash(PASSWORD, 10),
        nickname: `E2E ${roleCode}`,
        status: 1,
      },
      select: { id: true },
    });

    await prisma.sysAdminRole.create({
      data: { adminId: admin.id, roleId: role.id },
    });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [PermissionProbeController],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    cache = app.get(CacheService);
    prisma = app.get(PrismaService);

    // 先清一遍，防止上次异常退出留下的残留
    await deleteTestUsers();
    await createTestUser(OPERATOR_NAME, 'OPERATOR');
    await createTestUser(DATA_ADMIN_NAME, 'DATA_ADMIN');
  });

  afterAll(async () => {
    await deleteTestUsers();
    await app.close();
  });

  // ==========================================================================
  //  超级管理员：通配权限
  // ==========================================================================

  describe('超级管理员（通配权限 *）', () => {
    it('登录时拿到的是通配符而不是几十条权限', async () => {
      const data = await login('admin', 'Admin@123456');
      expect(data.roles).toContain('SUPER_ADMIN');
      expect(data.permissions).toEqual(['*']);
    });

    it('任意权限码的接口都放行', async () => {
      const { token } = await login('admin', 'Admin@123456');

      await probe(token, 'no-requirement').expect(200);
      await probe(token, 'spu-create').expect(200);
      await probe(token, 'log-clear').expect(200);
      await probe(token, 'either').expect(200);
    });
  });

  // ==========================================================================
  //  运营管理员
  // ==========================================================================

  describe('运营管理员（OPERATOR）', () => {
    let token: string;

    beforeAll(async () => {
      token = (await login(OPERATOR_NAME, PASSWORD)).token;
    });

    it('拿到的是具体权限码，不含通配符', async () => {
      const data = await login(OPERATOR_NAME, PASSWORD);
      expect(data.roles).toContain('OPERATOR');
      expect(data.permissions).not.toContain('*');
      expect(data.permissions).toContain('product:spu:create');
    });

    it('有 product:spu:create → 放行', async () => {
      await probe(token, 'spu-create').expect(200);
    });

    it('没有 system:log:clear → 403 / 10004', async () => {
      const res = await probe(token, 'log-clear').expect(403);
      const body = res.body as ApiBody<null>;

      expect(body.code).toBe(10004);
      // 错误信息里要指出缺哪个权限，方便排查
      expect(body.message).toContain('system:log:clear');
    });

    it('多权限码是「或」：有其中一个就放行', async () => {
      // OPERATOR 没有 system:log:clear，但有 product:spu:create
      await probe(token, 'either').expect(200);
    });
  });

  // ==========================================================================
  //  数据管理员：只读角色
  // ==========================================================================

  describe('数据管理员（DATA_ADMIN，只读角色）', () => {
    let token: string;

    beforeAll(async () => {
      token = (await login(DATA_ADMIN_NAME, PASSWORD)).token;
    });

    it('有 product:spu:list → 放行', async () => {
      await probe(token, 'spu-list').expect(200);
    });

    it('没有 product:spu:create → 403（只读角色不能写）', async () => {
      const res = await probe(token, 'spu-create').expect(403);
      expect((res.body as ApiBody<null>).code).toBe(10004);
    });

    it('没有任何一个「或」选项 → 403', async () => {
      // DATA_ADMIN 既没有 system:log:clear 也没有 product:spu:create
      const res = await probe(token, 'either').expect(403);
      expect((res.body as ApiBody<null>).code).toBe(10004);
    });

    it('未声明权限码的接口只要求登录 → 放行', async () => {
      await probe(token, 'no-requirement').expect(200);
    });

    it('没带 token 依然是 401（认证先于授权）', async () => {
      await request(app.getHttpServer()).get(`${PROBE}/spu-list`).expect(401);
    });
  });
});
