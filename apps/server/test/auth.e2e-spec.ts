import { type INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { CacheService } from './../src/common/cache/cache.service';
import { AUTH_CACHE } from './../src/common/constants/cache-keys';
import { configureApp } from './../src/setup-app';

/**
 * 全局路由前缀。
 *
 * ★ 这里踩过一次坑，记下来：
 *   configureApp() 里调用了 app.setGlobalPrefix('api/v1')，
 *   所以真实路径是 /api/v1/auth/login，而不是 /auth/login。
 *   测试里漏掉前缀，表现是清一色的 404 —— 看起来像"接口没注册"，
 *   实际是测试路径写错了。唯一例外是 /health，它被 setGlobalPrefix 排除了。
 */
const API = '/api/v1';
const LOGIN = `${API}/auth/login`;
const PROFILE = `${API}/auth/profile`;
const LOGOUT = `${API}/auth/logout`;
const HEALTH = '/health';

/** 统一响应体 */
interface ApiBody<T> {
  code: number;
  message: string;
  data: T;
  traceId: string;
}

interface LoginData {
  token: string;
  userInfo: {
    id: number;
    username: string;
    nickname: string;
    avatar: string | null;
  };
  roles: string[];
  permissions: string[];
}

interface ProfileData {
  userInfo: {
    id: number;
    username: string;
    nickname: string;
    avatar: string | null;
    email: string | null;
    phone: string | null;
  };
  roles: string[];
  permissions: string[];
  lastLoginAt: string | null;
}

interface CaptchaData {
  captchaId: string;
  svg: string;
  expiresIn: number;
}

/**
 * 认证模块端到端测试
 *
 * ⚠️ 前置条件：数据库已迁移且已执行 seed（pnpm --filter @mall-admin/server db:seed）
 *
 * ★ 关于"验证码"这个自动化测试的天然障碍
 *   验证码的答案只存在服务端缓存里，SVG 里是矢量轮廓（没有明文，这是对的）。
 *   所以测试没法"看图识字"。
 *   解决办法是从容器里拿到 CacheService，直接往缓存里塞一张已知答案的验证码 ——
 *   既测到登录的成功路径，又不必为了可测试性去削弱验证码本身。
 *   反过来，如果为了测试方便让接口返回明文答案，那是拿安全性换便利，绝对不能做。
 */
describe('认证 (e2e)', () => {
  let app: INestApplication<App>;
  let cache: CacheService;

  const ADMIN = { username: 'admin', password: 'Admin@123456' };

  /** 往缓存里塞一张答案已知的验证码，返回它的 captchaId */
  function issueCaptcha(text = 'abcd'): string {
    const captchaId = randomUUID();
    cache.set(AUTH_CACHE.captcha(captchaId), text.toLowerCase(), 120);
    return captchaId;
  }

  /** 完整走一次登录，返回 token */
  async function loginAsAdmin(): Promise<string> {
    const captchaId = issueCaptcha('abcd');
    const res = await request(app.getHttpServer())
      .post(LOGIN)
      .send({ ...ADMIN, captchaId, captcha: 'abcd' })
      .expect(200);
    return (res.body as ApiBody<LoginData>).data.token;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // ★ 复用生产环境的全局配置，保证这里测的就是线上行为。
    //   全局守卫是通过 AppModule 里的 APP_GUARD 注册的，
    //   所以只要 import 了 AppModule 就自动生效，不需要在这里补。
    configureApp(app);
    await app.init();

    cache = app.get(CacheService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ==========================================================================
  //  图形验证码
  // ==========================================================================

  describe('图形验证码', () => {
    it('返回 captchaId 与 SVG，且 SVG 中不含明文', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/auth/captcha`)
        .expect(200);
      const body = res.body as ApiBody<CaptchaData>;

      expect(body.code).toBe(0);
      expect(body.data.captchaId).toMatch(/^[0-9a-f-]{36}$/);
      expect(body.data.svg).toContain('<svg');
      expect(body.data.expiresIn).toBe(120);
      // ★ 明文绝不能出现在返回内容里，否则攻击者直接解析字符串就能绕过验证码
      expect(body.data.svg).not.toContain('<text');
    });

    it('每次请求的 captchaId 都不同（无状态设计）', async () => {
      const a = await request(app.getHttpServer()).get(`${API}/auth/captcha`);
      const b = await request(app.getHttpServer()).get(`${API}/auth/captcha`);

      expect((a.body as ApiBody<CaptchaData>).data.captchaId).not.toBe(
        (b.body as ApiBody<CaptchaData>).data.captchaId,
      );
    });
  });

  // ==========================================================================
  //  登录
  // ==========================================================================

  describe('登录', () => {
    it('验证码与密码都正确 → 登录成功并返回 JWT', async () => {
      const captchaId = issueCaptcha('abcd');

      const res = await request(app.getHttpServer())
        .post(LOGIN)
        .send({ ...ADMIN, captchaId, captcha: 'abcd' })
        .expect(200);

      const body = res.body as ApiBody<LoginData>;

      expect(body.code).toBe(0);
      expect(typeof body.traceId).toBe('string');

      // JWT 必须正好三段（header.payload.signature）
      expect(body.data.token.split('.')).toHaveLength(3);

      expect(body.data.userInfo.username).toBe('admin');
      // ★ BigInt 必须已经转成 number，否则 JSON.stringify 会抛
      //   "Do not know how to serialize a BigInt"
      expect(typeof body.data.userInfo.id).toBe('number');

      // 超级管理员走通配权限，不落权限表
      expect(body.data.roles).toContain('SUPER_ADMIN');
      expect(body.data.permissions).toEqual(['*']);
    });

    it('验证码大小写不敏感', async () => {
      const captchaId = issueCaptcha('aBcD');

      const res = await request(app.getHttpServer())
        .post(LOGIN)
        .send({ ...ADMIN, captchaId, captcha: 'abcd' })
        .expect(200);

      expect((res.body as ApiBody<LoginData>).code).toBe(0);
    });

    it('同一张验证码只能用一次（防重放）', async () => {
      const captchaId = issueCaptcha('abcd');
      const payload = { ...ADMIN, captchaId, captcha: 'abcd' };

      await request(app.getHttpServer()).post(LOGIN).send(payload).expect(200);

      // 第二次必须失败 —— 这条断言守着验证码不被暴力枚举的能力
      const second = await request(app.getHttpServer())
        .post(LOGIN)
        .send(payload)
        .expect(401);

      expect((second.body as ApiBody<null>).code).toBe(20002);
    });

    it('验证码错误 → 20002', async () => {
      const captchaId = issueCaptcha('abcd');

      const res = await request(app.getHttpServer())
        .post(LOGIN)
        .send({ ...ADMIN, captchaId, captcha: 'zzzz' })
        .expect(401);

      expect((res.body as ApiBody<null>).code).toBe(20002);
    });

    it('验证码已过期 → 20002', async () => {
      const res = await request(app.getHttpServer())
        .post(LOGIN)
        .send({ ...ADMIN, captchaId: randomUUID(), captcha: 'abcd' })
        .expect(401);

      expect((res.body as ApiBody<null>).code).toBe(20002);
    });

    it('密码错误 → 20001', async () => {
      const captchaId = issueCaptcha('abcd');

      const res = await request(app.getHttpServer())
        .post(LOGIN)
        .send({
          username: 'admin',
          password: 'wrong-password',
          captchaId,
          captcha: 'abcd',
        })
        .expect(401);

      expect((res.body as ApiBody<null>).code).toBe(20001);
    });

    it('账号不存在与密码错误返回同一错误码（不泄露账号是否存在）', async () => {
      const captchaIdA = issueCaptcha('abcd');
      const notExist = await request(app.getHttpServer())
        .post(LOGIN)
        .send({
          username: 'no-such-user',
          password: 'whatever',
          captchaId: captchaIdA,
          captcha: 'abcd',
        })
        .expect(401);

      const captchaIdB = issueCaptcha('abcd');
      const wrongPwd = await request(app.getHttpServer())
        .post(LOGIN)
        .send({
          username: 'admin',
          password: 'wrong-password',
          captchaId: captchaIdB,
          captcha: 'abcd',
        })
        .expect(401);

      const a = notExist.body as ApiBody<null>;
      const b = wrongPwd.body as ApiBody<null>;

      // 两者必须完全一致，否则攻击者能靠错误信息 / 状态码差异枚举账号
      expect(a.code).toBe(b.code);
      expect(a.message).toBe(b.message);
    });

    it('缺少必填字段被 ValidationPipe 拦下', async () => {
      const res = await request(app.getHttpServer())
        .post(LOGIN)
        .send({ username: 'admin' })
        .expect(400);

      expect((res.body as ApiBody<null>).code).toBe(10001);
    });
  });

  // ==========================================================================
  //  JWT 守卫（第 4 步的核心验收点）
  // ==========================================================================

  describe('JWT 守卫', () => {
    it('@Public 接口无需 token 即可访问', async () => {
      await request(app.getHttpServer()).get(HEALTH).expect(200);
    });

    it('受保护接口不带 token → 401 / 10002', async () => {
      const res = await request(app.getHttpServer()).get(PROFILE).expect(401);
      const body = res.body as ApiBody<null>;

      expect(body.code).toBe(10002);
      expect(body.message).toContain('未登录');
    });

    it('Authorization scheme 不是 Bearer → 401（不做宽松解析）', async () => {
      const token = await loginAsAdmin();

      // 常见的前端错误实现：写成 "Token xxx"，或者干脆不带 scheme
      await request(app.getHttpServer())
        .get(PROFILE)
        .set('Authorization', `Token ${token}`)
        .expect(401);

      await request(app.getHttpServer())
        .get(PROFILE)
        .set('Authorization', token)
        .expect(401);
    });

    it('token 被篡改 → 401', async () => {
      const token = await loginAsAdmin();
      // 改动 payload 部分的末尾，签名就不再匹配
      const [h, p, s] = token.split('.');
      const tampered = `${h}.${p.slice(0, -2)}xx.${s}`;

      const res = await request(app.getHttpServer())
        .get(PROFILE)
        .set('Authorization', `Bearer ${tampered}`)
        .expect(401);

      expect((res.body as ApiBody<null>).code).toBe(10002);
    });

    it('带合法 token → 200 并返回当前登录人', async () => {
      const token = await loginAsAdmin();

      const res = await request(app.getHttpServer())
        .get(PROFILE)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = res.body as ApiBody<ProfileData>;

      expect(body.code).toBe(0);
      expect(body.data.userInfo.username).toBe('admin');
      expect(body.data.roles).toContain('SUPER_ADMIN');
      expect(body.data.permissions).toEqual(['*']);
      // 登录时会写 lastLoginAt，所以这里应该有值
      expect(body.data.lastLoginAt).not.toBeNull();
    });

    it('登出后同一个 token 立即失效（黑名单生效）', async () => {
      const token = await loginAsAdmin();

      // 登出前可用
      await request(app.getHttpServer())
        .get(PROFILE)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(LOGOUT)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // ★ 这是 JWT 黑名单存在的全部意义：
      //   无状态 token 本身无法收回，登出必须靠服务端额外记账
      const afterLogout = await request(app.getHttpServer())
        .get(PROFILE)
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect((afterLogout.body as ApiBody<null>).code).toBe(10002);
    });
  });

  // ==========================================================================
  //  traceId
  // ==========================================================================

  describe('traceId', () => {
    it('成功响应带 traceId', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/auth/captcha`)
        .expect(200);
      const body = res.body as ApiBody<CaptchaData>;
      expect(body.traceId).toMatch(/^[0-9a-f]{16}$/);
    });

    it('★ 失败响应也必须带 traceId（401 由守卫抛出，中间件要能覆盖到）', async () => {
      const res = await request(app.getHttpServer()).get(PROFILE).expect(401);
      const body = res.body as ApiBody<null>;

      expect(body.code).toBe(10002);
      /**
       * ★ 这条断言锁住的是一个曾经真实存在的 bug：
       *   traceId 原先在 ResponseInterceptor 里生成，但守卫抛异常时拦截器
       *   根本不会执行 —— 于是所有 401/403/404 的 traceId 都是空字符串。
       *   而 traceId 的价值恰恰在出错时。
       *
       *   修法是把它挪到 TraceIdMiddleware（中间件是第一个执行阶段）。
       *   有这条断言在，将来谁再挪回拦截器都会立刻红。
       */
      expect(body.traceId).toMatch(/^[0-9a-f]{16}$/);
    });

    it('响应体里的 traceId 与响应头 x-trace-id 一致', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/auth/captcha`)
        .expect(200);
      const body = res.body as ApiBody<CaptchaData>;
      expect(res.headers['x-trace-id']).toBe(body.traceId);
    });

    it('上游传入的 x-trace-id 会被沿用（跨服务链路能串起来）', async () => {
      const upstream = 'abcdef0123456789';
      const res = await request(app.getHttpServer())
        .get(`${API}/auth/captcha`)
        .set('x-trace-id', upstream)
        .expect(200);

      expect((res.body as ApiBody<CaptchaData>).traceId).toBe(upstream);
      expect(res.headers['x-trace-id']).toBe(upstream);
    });
  });
});
