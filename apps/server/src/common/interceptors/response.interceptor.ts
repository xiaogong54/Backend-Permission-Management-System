import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { Observable, map } from 'rxjs';
import { ErrorCode } from '../constants/error-code';

/** 统一响应体 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  traceId: string;
}

/** 已经是这个形状的返回值就不再包装（比如导出文件、健康检查裸返回） */
const RAW_RESPONSE = Symbol('RAW_RESPONSE');

/** 打上标记，告诉拦截器"这个返回值原样透传，别包装" */
export function raw<T>(value: T): T & { [RAW_RESPONSE]: true } {
  return Object.assign(Object.create(null) as object, {
    value,
    [RAW_RESPONSE]: true,
  }) as never;
}

/**
 * 统一响应拦截器
 *
 * 把 controller 的返回值统一包装成：
 *   { code: 0, message: 'ok', data: <返回值>, traceId: '...' }
 *
 * 同时给每个请求生成 traceId，写进响应体。
 * 排查线上问题时，用户截图里的 traceId 能直接定位到日志。
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T> | T
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | T> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { traceId?: string }>();

    // 优先复用上游网关传进来的 traceId，没有就自己生成
    const incoming = request.headers['x-trace-id'];
    const traceId =
      (typeof incoming === 'string' && incoming) ||
      randomUUID().replace(/-/g, '').slice(0, 16);
    request.traceId = traceId;

    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && RAW_RESPONSE in data) {
          return (data as unknown as { value: T }).value;
        }
        return {
          code: ErrorCode.SUCCESS,
          message: 'ok',
          data,
          traceId,
        };
      }),
    );
  }
}
