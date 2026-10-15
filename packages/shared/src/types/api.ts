/**
 * 接口契约类型
 *
 * 这些类型必须与 apps/server 里的实现保持字段级一致：
 *   · ApiResponse      ←→ src/common/interceptors/response.interceptor.ts
 *   · Paginated        ←→ src/common/dto/pagination.dto.ts
 *   · ErrorCode 分段   ←→ src/common/constants/error-code.ts
 *
 * 放在共享包里的意义：改了后端响应结构，前端立刻编译报错，
 * 而不是等联调时才发现字段名对不上。
 */

/** 统一响应体 */
export interface ApiResponse<T = unknown> {
  /** 0 表示成功，其余见 ERROR_CODE */
  code: number;
  message: string;
  data: T;
  /** 请求追踪 ID，排查线上问题时直接拿它去搜日志 */
  traceId: string;
  timestamp?: string;
  path?: string;
}

/** 分页请求参数 */
export interface PageQuery {
  page?: number;
  pageSize?: number;
}

/** 分页响应体 */
export interface Paginated<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 通用下拉选项 */
export interface Option<T = number | string> {
  label: string;
  value: T;
}

/** 业务错误码分段，与后端 ErrorCode 枚举一一对应 */
export const ERROR_CODE = {
  SUCCESS: 0,

  PARAM_INVALID: 10001,
  UNAUTHORIZED: 10002,
  TOKEN_EXPIRED: 10003,
  FORBIDDEN: 10004,
  NOT_FOUND: 10005,
  TOO_MANY_REQUESTS: 10006,

  LOGIN_FAILED: 20001,
  CAPTCHA_INVALID: 20002,
  ACCOUNT_DISABLED: 20003,

  SKU_STOCK_NOT_ENOUGH: 30005,

  ORDER_STATUS_NOT_ALLOWED: 40001,
  ORDER_STOCK_NOT_ENOUGH: 40002,
  ORDER_STATUS_CHANGED: 40004,

  INTERNAL_ERROR: 50000,
} as const;
export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];
