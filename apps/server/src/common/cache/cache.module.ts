import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * 缓存模块
 *
 * 【换成 Redis 时改这里】
 *   1. 新建 cache.redis.service.ts，实现与 CacheService 相同的方法签名
 *      （set / get / del / take），内部改用 ioredis
 *   2. 把下面 providers 与 exports 里的 CacheService 换成 Redis 实现
 *   3. auth 模块一行都不用动 —— 它注入的一直是「缓存能力」这个抽象
 *
 * 【为什么声明成 @Global()】
 *   缓存和数据库一样属于基础设施，几乎每个业务模块都可能用到。
 *   如果每个模块都要 import 一遍 CacheModule，纯属噪音。
 *
 *   代价要说清楚：全局模块会让依赖关系变得隐式 ——
 *   看某个 Service 的构造函数时，不容易判断它依赖了哪些全局模块。
 *   所以这个口子只对**基础设施**开（Prisma、Cache），业务模块一律显式 import。
 */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
