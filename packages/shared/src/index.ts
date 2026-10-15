/**
 * @mall-admin/shared
 *
 * 前后端共用的类型、枚举与常量。
 *
 * 使用方式：
 *   后端  import { OrderStatus, ORDER_TRANSITIONS } from '@mall-admin/shared';
 *   前端  import { OrderStatus, ORDER_STATUS_TEXT } from '@mall-admin/shared';
 *
 * 构建方式：tsc 编译到 dist/，package.json 的 main/types 都指向 dist。
 * 根目录 pnpm build 会按依赖顺序先构建本包，再构建两个 app。
 */
export * from './enums';
export * from './types/api';
