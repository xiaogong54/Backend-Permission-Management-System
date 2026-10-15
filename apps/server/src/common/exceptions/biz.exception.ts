import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_MESSAGE, ErrorCode } from '../constants/error-code';

/**
 * 业务异常
 *
 * 用法：throw new BizException(ErrorCode.SKU_STOCK_NOT_ENOUGH);
 *       throw new BizException(ErrorCode.ORDER_STATUS_NOT_ALLOWED, '订单已发货，不能取消');
 *
 * 为什么继承 HttpException：
 *   NestJS 的异常过滤器按 HttpException 分流。继承它可以让业务异常走正常通道，
 *   同时我们在 AllExceptionsFilter 里优先读 code 字段。
 *   HTTP 状态码由业务码段位自动推导，业务层不用关心。
 */
export class BizException extends HttpException {
  /** 业务错误码 */
  readonly code: ErrorCode;
  /** 需要额外返回给前端的数据（比如库存不足时带上剩余数量） */
  readonly data?: unknown;

  constructor(code: ErrorCode, message?: string, data?: unknown) {
    const msg = message ?? ERROR_MESSAGE[code] ?? '未知错误';
    super(msg, BizException.httpStatusOf(code));
    this.code = code;
    this.data = data;
  }

  /**
   * 业务码段位 -> HTTP 状态码
   * 这样业务层只写业务码，HTTP 语义由框架统一负责，避免"什么都返回 200"
   */
  private static httpStatusOf(code: ErrorCode): HttpStatus {
    switch (code) {
      case ErrorCode.UNAUTHORIZED:
      case ErrorCode.TOKEN_EXPIRED:
      case ErrorCode.LOGIN_FAILED:
      case ErrorCode.CAPTCHA_INVALID:
        return HttpStatus.UNAUTHORIZED;

      case ErrorCode.FORBIDDEN:
      case ErrorCode.ACCOUNT_DISABLED:
      case ErrorCode.USER_DISABLED:
      case ErrorCode.BUILTIN_PROTECTED:
        return HttpStatus.FORBIDDEN;

      case ErrorCode.NOT_FOUND:
      case ErrorCode.ORDER_NOT_FOUND:
        return HttpStatus.NOT_FOUND;

      case ErrorCode.ACCOUNT_EXISTS:
      case ErrorCode.ROLE_IN_USE:
      case ErrorCode.CATEGORY_HAS_CHILDREN:
      case ErrorCode.CATEGORY_HAS_PRODUCTS:
      case ErrorCode.SPEC_IN_USE:
      case ErrorCode.PERMISSION_HAS_CHILDREN:
      case ErrorCode.USER_HAS_ORDERS:
      case ErrorCode.ORDER_STATUS_NOT_ALLOWED:
      case ErrorCode.ORDER_STATUS_CHANGED:
        return HttpStatus.CONFLICT;

      case ErrorCode.SKU_STOCK_NOT_ENOUGH:
      case ErrorCode.ORDER_STOCK_NOT_ENOUGH:
        return HttpStatus.CONFLICT;

      case ErrorCode.TOO_MANY_REQUESTS:
        return HttpStatus.TOO_MANY_REQUESTS;

      default:
        return HttpStatus.BAD_REQUEST;
    }
  }
}
