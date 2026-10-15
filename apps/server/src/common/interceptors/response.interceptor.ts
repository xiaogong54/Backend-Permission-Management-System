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
import type { WithTraceId } from '../middleware/trace-id.middleware';

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
 * ★ traceId 是**读**的，不是这里生成的
 *   生成工作已经移到 TraceIdMiddleware（见那个文件的注释）。
 *   原因：NestJS 的执行顺序是「中间件 → 守卫 → 拦截器」，
 *   守卫抛异常时拦截器不会执行 —— 如果 traceId 在这里生成，
 *   所有 401 / 403 / 404 响应的 traceId 都会是空的。
 *
 *   这里的 `??` 是防御性兜底：万一中间件因为某种原因没注册，
 *   宁可现场生成一个，也不要返回空 traceId 让问题无法定位。
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
    const request = context.switchToHttp().getRequest<Request & WithTraceId>();

    const traceId =
      request.traceId ?? randomUUID().replace(/-/g, '').slice(0, 16);
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
