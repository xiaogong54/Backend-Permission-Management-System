import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LogType, RoleCode, WILDCARD_PERMISSION } from '@mall-admin/shared';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { create as createSvgCaptcha } from 'svg-captcha';
import { CacheService } from '../../common/cache/cache.service';
import { ErrorCode } from '../../common/constants/error-code';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';

/** 验证码有效期（秒）。太短用户来不及输，太长给暴力破解留窗口 */
const CAPTCHA_TTL_SECONDS = 120;

/**
 * 缓存键前缀。加前缀是为了避免不同业务写到同一个 Redis 库时键名撞车。
 * 导出它是为了 e2e 测试能直接往缓存里塞一张验证码 ——
 * 否则测试没法"认出" SVG 里的字符，登录的成功路径就永远测不到。
 */
export const CAPTCHA_KEY_PREFIX = 'auth:captcha:';

/**
 * 一个"用不上的" BCrypt 哈希，仅用于账号不存在时做等时比较。
 * 明文是随机的，没有任何账号会匹配上它。
 */
const DUMMY_HASH =
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

/** 返回给前端的验证码结构 */
export interface CaptchaVo {
  /** 验证码标识：前端登录时要把它一起提交回来 */
  captchaId: string;
  /** SVG 图片内容，前端用 v-html 渲染 */
  svg: string;
  /** 有效期（秒） */
  expiresIn: number;
}

/** JWT 载荷。sub 按 JWT 规范必须是字符串 */
export interface JwtPayload {
  sub: string;
  username: string;
  roles: string[];
}

/** 登录成功返回给前端的数据 */
export interface LoginVo {
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

/** 登录时能拿到的请求元信息，用于写审计日志 */
export interface LoginContext {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly cache: CacheService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  // ==========================================================================
  //  图形验证码
  // ==========================================================================

  /**
   * 生成图形验证码
   *
   * 三个设计点：
   *   1. 用 captchaId 关联答案而不是 session —— 后端保持无状态，方便水平扩容
   *   2. 答案统一转小写存储，校验时也转小写，用户不必纠结大小写
   *   3. ignoreChars 去掉 0/O、1/l/I 这些肉眼难分的字符，
   *      否则用户输错被拒会以为是系统坏了（这类"玄学 bug"最难排查）
   */
  createCaptcha(): CaptchaVo {
    const captcha = createSvgCaptcha({
      size: 4,
      // 干扰线：0 太干净容易被 OCR，太多人眼也难认，3 是常用值
      noise: 3,
      color: false,
      background: '#f1f5f9',
      width: 112,
      height: 44,
      fontSize: 44,
      ignoreChars: '0oO1lLiI',
    });

    const captchaId = randomUUID();
    this.cache.set(
      `${CAPTCHA_KEY_PREFIX}${captchaId}`,
      captcha.text.toLowerCase(),
      CAPTCHA_TTL_SECONDS,
    );

    return { captchaId, svg: captcha.data, expiresIn: CAPTCHA_TTL_SECONDS };
  }

  /**
   * 校验并消费验证码
   *
   * 必须用 cache.take()（取出即删）而不是 get()：
   *   用 get 的话同一张验证码能被反复尝试，4 位字符只有一万种组合，
   *   几分钟就能暴力撞开。take 则一次不中就作废，必须重新拿图。
   */
  verifyCaptcha(captchaId: string, input: string): void {
    const expected = this.cache.take<string>(
      `${CAPTCHA_KEY_PREFIX}${captchaId}`,
    );

    if (!expected) {
      throw new BizException(
        ErrorCode.CAPTCHA_INVALID,
        '验证码已过期，请点击图片刷新',
      );
    }
    if (expected !== input.trim().toLowerCase()) {
      throw new BizException(ErrorCode.CAPTCHA_INVALID);
    }
  }

  // ==========================================================================
  //  登录
  // ==========================================================================

  /**
   * 账号密码登录
   *
   * 校验顺序是按「成本从低到高」排的，这一点很关键：
   *   验证码（内存查表，约 0.01ms）
   *   → 查账号（一次索引查询）
   *   → BCrypt 比对（约 100ms，故意慢）
   * 顺序反过来，攻击者不填验证码就能用登录接口把 CPU 打满。
   */
  async login(dto: LoginDto, ctx: LoginContext = {}): Promise<LoginVo> {
    // ---- 1. 验证码 ----
    this.verifyCaptcha(dto.captchaId, dto.captcha);

    // ---- 2. 查账号 ----
    const admin = await this.prisma.sysAdmin.findFirst({
      where: { username: dto.username, deletedAt: null },
      select: {
        id: true,
        username: true,
        password: true,
        nickname: true,
        avatar: true,
        status: true,
      },
    });

    // ★ 等时比较：账号不存在时也走一次 BCrypt
    //   否则"账号不存在"立刻返回，而"密码错误"要等 100ms，
    //   攻击者靠响应时间差就能枚举出哪些账号真实存在。
    //   这是很隐蔽的信息泄露，修复成本只是多算一次哈希。
    if (!admin) {
      await bcrypt.compare(dto.password, DUMMY_HASH);
      await this.writeLoginLog({
        username: dto.username,
        success: false,
        message: '账号不存在',
        ctx,
      });
      // 对外统一返回"账号或密码错误"，不暴露账号是否存在
      throw new BizException(ErrorCode.LOGIN_FAILED);
    }

    if (admin.status !== 1) {
      await this.writeLoginLog({
        adminId: admin.id,
        username: admin.username,
        success: false,
        message: '账号已被禁用',
        ctx,
      });
      throw new BizException(ErrorCode.ACCOUNT_DISABLED);
    }

    // ---- 3. 密码比对 ----
    const passwordMatched = await bcrypt.compare(dto.password, admin.password);
    if (!passwordMatched) {
      await this.writeLoginLog({
        adminId: admin.id,
        username: admin.username,
        success: false,
        message: '密码错误',
        ctx,
      });
      throw new BizException(ErrorCode.LOGIN_FAILED);
    }

    // ---- 4. 取角色与权限 ----
    const { roles, permissions } = await this.loadRolesAndPermissions(admin.id);

    // ---- 5. 签发 JWT ----
    const payload: JwtPayload = {
      // ★ 必须转字符串：JWT 规范要求 sub 是 string，
      //   而且 JSON.stringify 遇到 BigInt 会直接抛异常
      sub: String(admin.id),
      username: admin.username,
      roles,
    };
    const token = await this.jwt.signAsync(payload);

    // ---- 6. 记录登录时间与审计日志 ----
    // 用 allSettled：这两步失败不应该让登录失败。
    // 用户明明验证通过了却因为"写日志失败"登不进去，是明显的优先级错配。
    await Promise.allSettled([
      this.prisma.sysAdmin.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date(), lastLoginIp: ctx.ip ?? null },
      }),
      this.writeLoginLog({
        adminId: admin.id,
        username: admin.username,
        success: true,
        message: '登录成功',
        ctx,
      }),
    ]);

    return {
      token,
      userInfo: {
        // BigInt 不能直接进 JSON，统一在这里转成 number
        id: Number(admin.id),
        username: admin.username,
        nickname: admin.nickname,
        avatar: admin.avatar,
      },
      roles,
      permissions,
    };
  }

  /**
   * 加载角色码与权限码
   *
   * 超级管理员返回通配符 '*'，而不是把几十条权限逐条查出来。
   * 好处是后续新增权限点无需回头给超管补授权 ——
   * 这规避了 RBAC 系统最经典的事故："加了新功能，超管反而没权限"。
   */
  private async loadRolesAndPermissions(
    adminId: bigint,
  ): Promise<{ roles: string[]; permissions: string[] }> {
    const links = await this.prisma.sysAdminRole.findMany({
      where: { adminId },
      select: {
        role: { select: { code: true, status: true, deletedAt: true } },
      },
    });

    const roles = links
      .map((l) => l.role)
      .filter((r) => r.status === 1 && r.deletedAt === null)
      .map((r) => r.code);

    if (roles.includes(RoleCode.SUPER_ADMIN)) {
      return { roles, permissions: [WILDCARD_PERMISSION] };
    }

    // 普通角色的权限码要等权限树实现后从 sys_role_permission 查出来
    return { roles, permissions: [] };
  }

  /**
   * 写登录审计日志
   *
   * 自带 try/catch：日志系统出问题绝不能阻断业务。
   * 后面做全局操作日志拦截器时要遵守同一原则。
   */
  private async writeLoginLog(params: {
    adminId?: bigint;
    username: string;
    success: boolean;
    message: string;
    ctx: LoginContext;
  }): Promise<void> {
    try {
      await this.prisma.sysOperationLog.create({
        data: {
          type: LogType.LOGIN,
          adminId: params.adminId ?? null,
          username: params.username,
          module: '认证',
          action: params.success ? '登录成功' : '登录失败',
          status: params.success ? 1 : 0,
          errorMsg: params.success ? null : params.message,
          ip: params.ctx.ip ?? null,
          // 列宽 255，UA 可能超长，必须截断否则插入报错
          userAgent: params.ctx.userAgent?.slice(0, 255) ?? null,
        },
      });
    } catch (e) {
      this.logger.error(
        `写登录日志失败（不影响登录本身）: ${(e as Error).message}`,
      );
    }
  }
}
