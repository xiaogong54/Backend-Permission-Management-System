import { Global, Module } from '@nestjs/common';
import { PermissionService } from './permission.service';

/**
 * 权限查询模块
 *
 * 声明成 @Global() 的理由和 CacheModule 一样：
 *   PermissionService 的两个使用方分别在 AppModule（注册 PermissionGuard）
 *   和 AuthModule（登录时取角色权限），
 *   如果做成普通模块，两边都要 import 一遍，纯属噪音。
 *
 * 仍然只对**基础设施**开这个口子，业务模块一律显式 import。
 */
@Global()
@Module({
  providers: [PermissionService],
  exports: [PermissionService],
})
export class PermissionModule {}
