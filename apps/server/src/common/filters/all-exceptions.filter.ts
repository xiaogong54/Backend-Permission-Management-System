import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ERROR_MESSAGE, ErrorCode } from '../constants/error-code';
import { BizException } from '../exceptions/biz.exception';

/**
 * 全局异常过滤器 —— 把所有异常收敛成统一响应结构
 *
 *   { code: 40002, message: '商品库存不足，无法下单', data: null, traceId: '...' }
 *
 * 三条设计原则：
 *   1. 永不把堆栈泄露给客户端（500 只返回一句通用提示），堆栈只进服务端日志
 *   2. 业务异常（BizException）保留自己的 code 和 message
 *   3. 未预期的异常一律降级成 INTERNAL_ERROR，但日志里留全量信息便于排查
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const traceId = (request as Request & { traceId?: string }).traceId ?? '';

    let httpStatus: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: number = ErrorCode.INTERNAL_ERROR;
    let message: string = ERROR_MESSAGE[ErrorCode.INTERNAL_ERROR];
    let data: unknown = null;

    if (exception instanceof BizException) {
      httpStatus = exception.getStatus();
      code = exception.code;
      message = exception.message;
      data = exception.data ?? null;
    } else if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      code = this.bizCodeOfHttpStatus(httpStatus);
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const body = res as { message?: string | string[]; error?: string };
        // ValidationPipe 抛出的 message 是数组，取第一条更友好
        message = Array.isArray(body.message)
          ? (body.message[0] ?? ERROR_MESSAGE[ErrorCode.PARAM_INVALID])
          : (body.message ?? ERROR_MESSAGE[code] ?? exception.message);
      } else {
        message = exception.message;
      }
    } else {
      // 非 HttpException：说明是没预料到的错误
      const err = exception as Error;
      this.logger.error(
        `未捕获异常 ${request.method} ${request.url} traceId=${traceId}`,
        err?.stack ?? String(exception),
      );
    }

    // 5xx 服务端错误必须记日志；4xx 属于客户端问题，记 warn 即可
    const logPayload = `${request.method} ${request.url} -> ${httpStatus} code=${code} traceId=${traceId}`;
    if (httpStatus >= 500) {
      this.logger.error(logPayload);
    } else {
      this.logger.warn(`${logPayload} : ${message}`);
    }

    response.status(httpStatus).json({
      code,
      message,
      data,
      traceId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  /**
   * HTTP 状态码 -> 通用业务码，保证前端只需认业务码
   *
   * 用映射表而不是 switch 的原因：
   *   NestJS 的 HttpStatus 并非标准 TS 枚举，拿裸 number 与它做 switch 比较
   *   会触发 @typescript-eslint/no-unsafe-enum-comparison；
   *   而加 `as HttpStatus` 强转又会被 --fix 当成"多余断言"自动删掉，形成死循环。
   *   映射表既绕开这个坑，读起来也比 switch 更短。
   */
  private static readonly HTTP_TO_BIZ: Record<number, ErrorCode> = {
    [HttpStatus.BAD_REQUEST]: ErrorCode.PARAM_INVALID,
    [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
    [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
    [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
    [HttpStatus.METHOD_NOT_ALLOWED]: ErrorCode.METHOD_NOT_ALLOWED,
    [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.TOO_MANY_REQUESTS,
  };

  private bizCodeOfHttpStatus(status: number): ErrorCode {
    const mapped = AllExceptionsFilter.HTTP_TO_BIZ[status];
    if (mapped !== undefined) return mapped;
    // 没登记的状态码：5xx 归为服务端错误，其余归为参数问题
    return status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.PARAM_INVALID;
  }
}
