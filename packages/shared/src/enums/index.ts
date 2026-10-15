/**
 * 状态枚举
 *
 * 为什么用「const 对象 + 类型别名」而不是 TypeScript 的 enum：
 *   · enum 会被编译成运行时代码，且不支持 tree-shaking
 *   · const 对象配合 as const 可以同时得到值对象和联合类型，产物更干净
 *   · 与后端 Prisma 生成的整型字段对接时，两边都是普通 number，没有额外阻抗
 *
 * 数据库里这些字段一律是 TINYINT，所以数值一旦确定就不能再改，
 * 只能往后追加新值。
 */

// ============================================================================
//  通用
// ============================================================================

/** 启用 / 禁用 */
export const CommonStatus = {
  DISABLED: 0,
  ENABLED: 1,
} as const;
export type CommonStatus = (typeof CommonStatus)[keyof typeof CommonStatus];

// ============================================================================
//  系统权限域
// ============================================================================

/** 权限节点类型 */
export const PermissionType = {
  /** 目录：仅用于菜单分组，不参与鉴权 */
  DIR: 1,
  /** 菜单：对应一个前端路由页面 → 页面级权限 */
  MENU: 2,
  /** 按钮：前端显隐 + 后端接口鉴权（与接口权限共用同一个 code） */
  BUTTON: 3,
  /** 接口：无对应按钮的纯接口权限 */
  API: 4,
} as const;
export type PermissionType = (typeof PermissionType)[keyof typeof PermissionType];

/** 内置角色码 */
export const RoleCode = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  OPERATOR: 'OPERATOR',
  DATA_ADMIN: 'DATA_ADMIN',
} as const;
export type RoleCode = (typeof RoleCode)[keyof typeof RoleCode];

/** 超级管理员的通配权限码：登录时后端直接下发它，鉴权时一律放行 */
export const WILDCARD_PERMISSION = '*';

/** 操作日志类型 */
export const LogType = {
  /** 业务操作 */
  OPERATION: 1,
  /** 登录认证 */
  LOGIN: 2,
} as const;
export type LogType = (typeof LogType)[keyof typeof LogType];

// ============================================================================
//  订单域
// ============================================================================

/**
 * 订单状态（状态机主状态）
 *
 *   1 待付款 ──支付──► 2 待发货 ──发货──► 3 已发货 ──确认收货──► 4 已完成
 *      │                  │
 *      └──取消/超时──► 5 已取消 ◄──取消（仅后台）
 */
export const OrderStatus = {
  PENDING_PAYMENT: 1,
  PENDING_SHIPMENT: 2,
  SHIPPED: 3,
  COMPLETED: 4,
  CANCELLED: 5,
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

/** 订单状态中文名，前端标签直接用 */
export const ORDER_STATUS_TEXT: Record<OrderStatus, string> = {
  [OrderStatus.PENDING_PAYMENT]: '待付款',
  [OrderStatus.PENDING_SHIPMENT]: '待发货',
  [OrderStatus.SHIPPED]: '已发货',
  [OrderStatus.COMPLETED]: '已完成',
  [OrderStatus.CANCELLED]: '已取消',
};

/** Element Plus 标签配色，与 ORDER_STATUS_TEXT 一一对应 */
export const ORDER_STATUS_TAG: Record<
  OrderStatus,
  'warning' | 'primary' | 'info' | 'success' | 'danger'
> = {
  [OrderStatus.PENDING_PAYMENT]: 'warning',
  [OrderStatus.PENDING_SHIPMENT]: 'primary',
  [OrderStatus.SHIPPED]: 'info',
  [OrderStatus.COMPLETED]: 'success',
  [OrderStatus.CANCELLED]: 'danger',
};

/** 支付状态 */
export const PayStatus = {
  UNPAID: 0,
  PAID: 1,
  REFUNDED: 2,
} as const;
export type PayStatus = (typeof PayStatus)[keyof typeof PayStatus];

/** 订单可触发的事件 */
export const OrderEvent = {
  PAY: 'PAY',
  SHIP: 'SHIP',
  CONFIRM: 'CONFIRM',
  CANCEL: 'CANCEL',
  TIMEOUT: 'TIMEOUT',
} as const;
export type OrderEvent = (typeof OrderEvent)[keyof typeof OrderEvent];

/**
 * 订单状态转移表
 *
 * 只在这一处声明"什么状态能接受什么事件、变成什么状态"，
 * 后端的状态机守卫和前端按钮显隐都读它，杜绝两边逻辑漂移。
 * 表里没有的组合一律视为非法操作。
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, Partial<Record<OrderEvent, OrderStatus>>> = {
  [OrderStatus.PENDING_PAYMENT]: {
    [OrderEvent.PAY]: OrderStatus.PENDING_SHIPMENT,
    [OrderEvent.CANCEL]: OrderStatus.CANCELLED,
    [OrderEvent.TIMEOUT]: OrderStatus.CANCELLED,
  },
  [OrderStatus.PENDING_SHIPMENT]: {
    [OrderEvent.SHIP]: OrderStatus.SHIPPED,
    [OrderEvent.CANCEL]: OrderStatus.CANCELLED,
  },
  [OrderStatus.SHIPPED]: {
    [OrderEvent.CONFIRM]: OrderStatus.COMPLETED,
  },
  [OrderStatus.COMPLETED]: {},
  [OrderStatus.CANCELLED]: {},
};

/** 判断某个事件在当前状态下是否合法 */
export function canTransition(from: OrderStatus, event: OrderEvent): boolean {
  return ORDER_TRANSITIONS[from]?.[event] !== undefined;
}

// ============================================================================
//  C 端用户域
// ============================================================================

export const UserStatus = {
  DISABLED: 0,
  NORMAL: 1,
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const UserLevel = {
  NORMAL: 1,
  SILVER: 2,
  GOLD: 3,
  DIAMOND: 4,
} as const;
export type UserLevel = (typeof UserLevel)[keyof typeof UserLevel];
