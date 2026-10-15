import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

/** 一条缓存记录：值 + 绝对过期时间戳（毫秒） */
interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/** 过期扫描间隔 */
const SWEEP_INTERVAL_MS = 60_000;

/**
 * 缓存服务
 *
 * ============================================================================
 *  为什么要有这一层，而不是直接调 Redis 客户端
 * ============================================================================
 *  业务代码依赖的是「能存能取能设过期」这个**能力**，而不是「Redis」这个**实现**。
 *  把它抽成接口后：
 *    · 现在本机没装 Redis，用内存 Map 顶上，功能不缺
 *    · 以后要换 Redis，只需新增一个实现类并改 CacheModule 里的 provider，
 *      auth 模块一行都不用动
 *
 *  这就是依赖倒置原则在工程里的实际价值 —— 它不是「为了解耦而解耦」，
 *  而是让「现在没装 Redis」这件事不成为阻塞。
 *
 * ============================================================================
 *  为什么不用数据库存验证码
 * ============================================================================
 *  验证码是典型的短生命周期高频写数据：
 *    · 生命周期 2 分钟，写进去马上就会失效，没有持久化价值
 *    · 每次刷新验证码都是一次写入，会给 MySQL 带来无意义的写压力
 *    · 过期的行还需要额外的清理任务
 *  内存/Redis 这类带 TTL 的存储才是它的正确归宿。
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly store = new Map<string, CacheEntry>();
  private readonly sweeper: NodeJS.Timeout;

  constructor() {
    this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    // ★ unref() 很关键：告诉 Node「这个定时器不要阻止进程退出」。
    //   不加的话，跑测试或优雅停机时进程会一直挂住不退出，
    //   表现为 jest 跑完不结束、Ctrl+C 没反应 —— 这个坑很隐蔽。
    this.sweeper.unref();
  }

  /** 写入并设置过期时间（秒） */
  set(key: string, value: unknown, ttlSeconds: number): void {
    this.store.set(key, {
      value,
      // 存「绝对时间戳」而不是「剩余秒数」：
      // 剩余秒数要在每次读取时重新计算，容易写错，且不好排查
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /** 读取。已过期则顺手删掉并返回 null */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  del(key: string): void {
    this.store.delete(key);
  }

  /**
   * 取出并立即删除 —— 用于「一次性凭证」
   *
   * 图形验证码、重置密码链接、短信码都必须用它，而不是 get + del。
   * 关键在于**先删后判**：不管校验成功还是失败，这张凭证都已经作废。
   * 否则攻击者拿到一张验证码就能无限次重试，验证码形同虚设。
   */
  take<T>(key: string): T | null {
    const value = this.get<T>(key);
    this.store.delete(key);
    return value;
  }

  /** 清空全部（测试里用） */
  clear(): void {
    this.store.clear();
  }

  /** 当前条目数，用于排查内存是否异常增长 */
  get size(): number {
    return this.store.size;
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
    this.store.clear();
  }

  /**
   * 主动清理过期条目
   *
   * 为什么需要它：get() 只在「读到某个键」时才发现它过期，
   * 那些写入后再没人读的键会永远留在 Map 里造成内存泄漏。
   */
  private sweep(): void {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
        removed += 1;
      }
    }
    if (removed > 0) {
      this.logger.debug(
        `清理过期缓存 ${removed} 条，当前剩余 ${this.store.size} 条`,
      );
    }
  }
}
