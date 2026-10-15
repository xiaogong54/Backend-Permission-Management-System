import { CacheService } from './cache.service';

/**
 * CacheService 单元测试
 *
 * 为什么这个类值得单独测：
 *   它承载了两个**正确性关键**的语义，写错了不会报错，只会静默出问题：
 *     1. TTL 到期必须失效 —— 写错的话验证码永不过期
 *     2. take 必须"取出即删" —— 写错的话同一张验证码可以被反复尝试，
 *        4 位字符只有一万种组合，暴力破解几分钟就撞开了
 *
 * 这个测试不依赖数据库，所以不需要 NODE_OPTIONS=--experimental-vm-modules
 * 那套 Prisma WASM 的处理，跑得又快又稳。
 */
describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService();
  });

  afterEach(() => {
    // 必须清理：构造函数里起了定时器，不清理每个用例都会留一个
    cache.onModuleDestroy();
  });

  describe('基础读写', () => {
    it('set 之后能 get 到同一个值', () => {
      cache.set('k', 'v', 60);
      expect(cache.get<string>('k')).toBe('v');
    });

    it('get 不存在的键返回 null', () => {
      expect(cache.get('not-exist')).toBeNull();
    });

    it('del 能主动删除', () => {
      cache.set('k', 'v', 60);
      cache.del('k');
      expect(cache.get('k')).toBeNull();
    });

    it('存对象时保持引用相等，不做 JSON 序列化', () => {
      const obj = { a: 1 };
      cache.set('k', obj, 60);
      // toBe 而不是 toEqual：证明存的是同一个引用，没有偷偷序列化
      expect(cache.get<typeof obj>('k')).toBe(obj);
    });
  });

  describe('过期语义', () => {
    it('ttl 为 0 的键立即过期', () => {
      cache.set('k', 'v', 0);
      expect(cache.get('k')).toBeNull();
    });

    it('读到过期键时会顺手把它删掉，避免内存泄漏', () => {
      cache.set('k', 'v', 0);
      expect(cache.size).toBe(1);

      cache.get('k'); // 触发惰性删除

      expect(cache.size).toBe(0);
    });

    it('未过期的键不受影响', () => {
      cache.set('alive', 'v', 3600);
      expect(cache.get('alive')).toBe('v');
    });
  });

  describe('take —— 一次性凭证语义', () => {
    it('取出后立即删除，第二次必须拿不到', () => {
      cache.set('captcha', 'ab12', 60);

      expect(cache.take<string>('captcha')).toBe('ab12');
      // ★ 这一行是防暴力破解的核心断言：验证码不能被重放
      expect(cache.take<string>('captcha')).toBeNull();
    });

    it('对不存在的键返回 null 而不是抛异常', () => {
      expect(cache.take('not-exist')).toBeNull();
    });

    it('已过期的凭证 take 到 null', () => {
      cache.set('captcha', 'ab12', 0);
      expect(cache.take<string>('captcha')).toBeNull();
    });

    it('take 之后 size 归零', () => {
      cache.set('captcha', 'ab12', 60);
      cache.take('captcha');
      expect(cache.size).toBe(0);
    });
  });

  describe('过期清理', () => {
    it('sweep 清掉过期键、保留未过期键', () => {
      cache.set('expired-1', 1, 0);
      cache.set('expired-2', 2, 0);
      cache.set('alive', 3, 3600);
      expect(cache.size).toBe(3);

      // sweep 是 private 的。这里用类型断言直接调用 ——
      // 它关系到"内存会不会慢慢涨爆"这个正确性问题，值得单独验证。
      // 走定时器的话要等 60 秒，测试会变得又慢又脆。
      (cache as unknown as { sweep: () => void }).sweep();

      expect(cache.size).toBe(1);
      expect(cache.get<number>('alive')).toBe(3);
    });
  });

  describe('生命周期', () => {
    it('onModuleDestroy 之后 store 被清空', () => {
      cache.set('k', 'v', 60);
      cache.onModuleDestroy();
      // 这里不再读值（服务已销毁），只验证内部状态被释放
      expect(cache.size).toBe(0);
    });
  });
});
