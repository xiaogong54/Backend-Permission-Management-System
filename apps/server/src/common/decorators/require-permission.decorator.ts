import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requirePermission';

/**
 * 声明接口所需的权限码
 *
 * 用法：
 *   @RequirePermission('system:admin:list')                    // 需要这一个权限
 *   @RequirePermission('product:spu:update', 'product:spu:create')  // 满足任意一个即可
 *
 * ★ 多个参数是「或」不是「与」
 *   绝大多数场景是"这几条路里任一条都行"，比如"编辑"和"新增"两个权限都能改某个字段。
 *   如果确实需要"与"，那通常说明这个接口该拆成两个，而不是让一个接口要求多个权限。
 *
 * ★ 装饰器只负责声明，不负责判断
 *   权限判断在 PermissionGuard 里。把"声明做什么"和"怎么判断"分开，
 *   以后要换成 ABAC（基于属性）或加上数据范围判断，业务代码不用改。
 *
 * ★ 没写这个装饰器的接口 = 只要求登录
 *   因为全局守卫的默认策略是"要求登录"，而权限是登录之上的额外要求。
 */
export const RequirePermission = (...codes: string[]) =>
  SetMetadata(PERMISSION_KEY, codes);
