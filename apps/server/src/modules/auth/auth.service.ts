import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LogType, RoleCode, WILDCARD_PERMISSION } from '@mall-admin/shared';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { create as createSvgCaptcha } from 'svg-captcha';
import { CacheService } from '../../common/cache/cache.service';
import { AUTH_CACHE } from '../../common/constants/cache-keys';
import { ErrorCode } from '../../common/constants/error-code';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';

/** 验证码有效期（秒）。太短用户来不及输，太长给暴力破解留窗口 */
const CAPTCHA_TTL_SECONDS = 120;

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

/**
 * JWT 载荷
 *
 * jti / iat / exp 由 jsonwebtoken 自动写入，不需要我们手动填。
 * 但类型上必须声明，否则守卫与登出逻辑取不到它们。
 */
export interface JwtPayload {
  /** 管理员 id，按 JWT 规范是字符串 */
  sub: string;
  username: string;
  roles: string[];
  /** JWT ID —— 登出黑名单的抓手 */
  jti?: string;
  /** 签发时间（秒级时间戳） */
  iat?: number;
  /** 过期时间（秒级时间戳） */
  exp?: number;
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

/** 当前登录人信息（比 LoginVo 多几个字段，用于个人中心） */
export interface ProfileVo {
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
      AUTH_CACHE.captcha(captchaId),
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
    const expected = this.cache.take<string>(AUTH_CACHE.captcha(captchaId));

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
    const token = await this.jwt.signAsync(payload, {
      // ★ jti 是登出黑名单的唯一抓手。
      //   没有它，"退出登录"只能做到前端删掉本地 token，
      //   服务端依然认这个 token —— 那是假登出。
      jwtid: randomUUID(),
    });

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

  // ==========================================================================
  //  当前登录人 / 登出
  // ==========================================================================

  /**
   * 查询当前登录人的完整信息
   *
   * ★ 为什么这里要重新查库，而不是直接用 token 里的载荷
   *   守卫验签只证明"这个 token 是我签发的、没被篡改"，
   *   它**不保证这个账号现在还能用**。
   *   签发之后账号可能被禁用、被删除、角色被改 —— token 里存的是签发那一刻的快照。
   *
   *   "token 有效" 和 "账号可用" 是两件事。
   *   所以凡是要拿账号现状的接口，都必须回源查库。
   */
  async getProfile(adminId: bigint): Promise<ProfileVo> {
    const admin = await this.prisma.sysAdmin.findFirst({
      where: { id: adminId, deletedAt: null },
      select: {
        id: true,
        username: true,
        nickname: true,
        avatar: true,
        email: true,
        phone: true,
        status: true,
        lastLoginAt: true,
      },
    });

    if (!admin) {
      throw new BizException(
        ErrorCode.UNAUTHORIZED,
        '账号已被删除，请重新登录',
      );
    }
    if (admin.status !== 1) {
      throw new BizException(ErrorCode.ACCOUNT_DISABLED);
    }

    // 角色可能刚被管理员改过，这里也用最新的，不用 token 里的快照
    const { roles, permissions } = await this.loadRolesAndPermissions(admin.id);

    return {
      userInfo: {
        id: Number(admin.id),
        username: admin.username,
        nickname: admin.nickname,
        avatar: admin.avatar,
        email: admin.email,
        phone: admin.phone,
      },
      roles,
      permissions,
      lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
    };
  }

  /**
   * 退出登录：把当前 token 加入黑名单
   *
   * TTL 只设到这个 token 原本的过期时间 —— 过期之后 JWT 自己就失效了，
   * 黑名单条目没有继续保留的意义，让缓存自动清掉最省内存。
   */
  async logout(payload: JwtPayload): Promise<{ message: string }> {
    if (payload.jti && payload.exp) {
      const ttlSeconds = payload.exp - Math.floor(Date.now() / 1000);

      if (ttlSeconds > 0) {
        // cache.set 是同步的，不需要 await
        this.cache.set(
          AUTH_CACHE.tokenBlacklist(payload.jti),
          1,
          // 至少 1 秒：避免边界情况下算出 0 或负数，导致写进一个立即过期的键
          Math.max(ttlSeconds, 1),
        );
      }
    } else {
      // 理论上不会走到这里（签发时一定带 jti 和 exp）。
      // 但必须留这个分支：旧版本签发的、没有 jti 的 token 是拉不黑的，
      // 静默跳过会让"登出失败"变得完全不可观测。
      this.logger.warn(
        `登出时 token 缺少 jti/exp，无法加入黑名单: sub=${payload.sub}`,
      );
    }

    await this.writeLoginLog({
      adminId: BigInt(payload.sub),
      username: payload.username,
      success: true,
      message: '退出登录',
      action: '退出登录',
      ctx: {},
    });

    return { message: '已退出登录' };
  }

  // ==========================================================================
  //  内部工具
  // ==========================================================================

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
   * 写登录 / 登出审计日志
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
    /** 不传时按 success 自动推断为「登录成功 / 登录失败」 */
    action?: string;
  }): Promise<void> {
    try {
      await this.prisma.sysOperationLog.create({
        data: {
          type: LogType.LOGIN,
          adminId: params.adminId ?? null,
          username: params.username,
          module: '认证',
          action: params.action ?? (params.success ? '登录成功' : '登录失败'),
          status: params.success ? 1 : 0,
          errorMsg: params.success ? null : params.message,
          ip: params.ctx.ip ?? null,
          // 列宽 255，UA 可能超长，必须截断否则插入报错
          userAgent: params.ctx.userAgent?.slice(0, 255) ?? null,
        },
      });
    } catch (e) {
      this.logger.error(
        `写认证日志失败（不影响业务本身）: ${(e as Error).message}`,
      );
    }
  }
}
