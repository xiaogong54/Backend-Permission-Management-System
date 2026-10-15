import { type INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { CacheService } from './../src/common/cache/cache.service';
import { CAPTCHA_KEY_PREFIX } from './../src/modules/auth/auth.service';
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
    cache.set(`${CAPTCHA_KEY_PREFIX}${captchaId}`, text.toLowerCase(), 120);
    return captchaId;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // ★ 复用生产环境的全局配置，保证这里测的就是线上行为
    configureApp(app);
    await app.init();

    cache = app.get(CacheService);
  });

  afterAll(async () => {
    await app.close();
  });

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

    // 第一次成功
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
    // whitelist + 必填校验生效时，缺字段会因为校验失败返回 10001
    const res = await request(app.getHttpServer())
      .post(LOGIN)
      .send({ username: 'admin' })
      .expect(400);

    expect((res.body as ApiBody<null>).code).toBe(10001);
  });
});
