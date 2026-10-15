/**
 * 全站业务错误码
 *
 * 分段规则：
 *   0        成功
 *   1xxxx    通用（参数、认证、权限、限流）
 *   2xxxx    系统权限模块
 *   3xxxx    商品模块
 *   4xxxx    订单模块
 *   5xxxx    用户模块
 *   6xxxx    文件模块
 *   5xxxxx   服务端内部错误
 *
 * 为什么不用 HTTP 状态码代替：
 *   HTTP 状态码表达"请求这一层"的结果（200/400/401/403/404/409/429），
 *   业务错误码表达"业务这一层"的结果（库存不足 / 状态不允许跃迁）。
 *   两者正交，前端需要根据业务码做差异化处理（比如 40002 要刷新列表重试）。
 */
export enum ErrorCode {
  SUCCESS = 0,

  // ---------- 通用 1xxxx ----------
  PARAM_INVALID = 10001,
  UNAUTHORIZED = 10002,
  TOKEN_EXPIRED = 10003,
  FORBIDDEN = 10004,
  NOT_FOUND = 10005,
  TOO_MANY_REQUESTS = 10006,
  METHOD_NOT_ALLOWED = 10007,

  // ---------- 系统权限 2xxxx ----------
  LOGIN_FAILED = 20001,
  CAPTCHA_INVALID = 20002,
  ACCOUNT_DISABLED = 20003,
  OLD_PASSWORD_WRONG = 20004,
  ACCOUNT_EXISTS = 20005,
  ROLE_IN_USE = 20006,
  BUILTIN_PROTECTED = 20007,
  PERMISSION_HAS_CHILDREN = 20008,

  // ---------- 商品 3xxxx ----------
  CATEGORY_HAS_CHILDREN = 30001,
  CATEGORY_HAS_PRODUCTS = 30002,
  SPEC_IN_USE = 30003,
  SPU_NOT_ON_SALE = 30004,
  SKU_STOCK_NOT_ENOUGH = 30005,

  // ---------- 订单 4xxxx ----------
  ORDER_STATUS_NOT_ALLOWED = 40001,
  ORDER_STOCK_NOT_ENOUGH = 40002,
  ORDER_NOT_FOUND = 40003,
  ORDER_STATUS_CHANGED = 40004,

  // ---------- 用户 5xxxx ----------
  USER_DISABLED = 50001,
  USER_HAS_ORDERS = 50002,

  // ---------- 文件 6xxxx ----------
  FILE_TYPE_NOT_ALLOWED = 60001,
  FILE_TOO_LARGE = 60002,

  // ---------- 服务端 ----------
  INTERNAL_ERROR = 50000,
}

/** 错误码 -> 默认中文提示。业务层没给 message 时用它兜底 */
export const ERROR_MESSAGE: Record<number, string> = {
  [ErrorCode.SUCCESS]: 'ok',

  [ErrorCode.PARAM_INVALID]: '请求参数不合法',
  [ErrorCode.UNAUTHORIZED]: '未登录或登录已失效',
  [ErrorCode.TOKEN_EXPIRED]: '登录状态已过期，请重新登录',
  [ErrorCode.FORBIDDEN]: '没有该操作权限',
  [ErrorCode.NOT_FOUND]: '请求的资源不存在',
  [ErrorCode.TOO_MANY_REQUESTS]: '操作过于频繁，请稍后再试',
  [ErrorCode.METHOD_NOT_ALLOWED]: '请求方法不被允许',

  [ErrorCode.LOGIN_FAILED]: '账号或密码错误',
  [ErrorCode.CAPTCHA_INVALID]: '验证码错误或已过期',
  [ErrorCode.ACCOUNT_DISABLED]: '账号已被禁用',
  [ErrorCode.OLD_PASSWORD_WRONG]: '原密码不正确',
  [ErrorCode.ACCOUNT_EXISTS]: '账号已存在',
  [ErrorCode.ROLE_IN_USE]: '该角色下还有管理员，无法删除',
  [ErrorCode.BUILTIN_PROTECTED]: '内置数据不允许修改或删除',
  [ErrorCode.PERMISSION_HAS_CHILDREN]: '该权限下还有子节点，无法删除',

  [ErrorCode.CATEGORY_HAS_CHILDREN]: '该分类下还有子分类，无法删除',
  [ErrorCode.CATEGORY_HAS_PRODUCTS]: '该分类下还有商品，无法删除',
  [ErrorCode.SPEC_IN_USE]: '该规格已被商品使用，无法删除',
  [ErrorCode.SPU_NOT_ON_SALE]: '商品未上架',
  [ErrorCode.SKU_STOCK_NOT_ENOUGH]: '库存不足',

  [ErrorCode.ORDER_STATUS_NOT_ALLOWED]: '当前订单状态不允许该操作',
  [ErrorCode.ORDER_STOCK_NOT_ENOUGH]: '商品库存不足，无法下单',
  [ErrorCode.ORDER_NOT_FOUND]: '订单不存在',
  [ErrorCode.ORDER_STATUS_CHANGED]: '订单状态已变更，请刷新后重试',

  [ErrorCode.USER_DISABLED]: '该用户已被禁用',
  [ErrorCode.USER_HAS_ORDERS]: '该用户已有订单，只能禁用不能删除',

  [ErrorCode.FILE_TYPE_NOT_ALLOWED]: '不支持的文件类型',
  [ErrorCode.FILE_TOO_LARGE]: '文件体积超出限制',

  [ErrorCode.INTERNAL_ERROR]: '服务器内部错误',
};
