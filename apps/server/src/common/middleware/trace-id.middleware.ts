import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

/** 请求 ID 的头部名，沿用业界通用的 x-trace-id */
export const TRACE_ID_HEADER = 'x-trace-id';

/** 挂到 request 上的字段名 */
export interface WithTraceId {
  traceId?: string;
}

/**
 * traceId 中间件
 *
 * ============================================================================
 *  ★ 为什么必须放在「中间件」而不是「拦截器」里生成
 * ============================================================================
 *  NestJS 的执行顺序是：
 *
 *      中间件 → 守卫 → 拦截器 → 管道 → 控制器
 *               ↑        ↑
 *         401 在这里抛   traceId 在这里生成
 *
 *  原先 traceId 是在 ResponseInterceptor.intercept() 里生成的。
 *  但**守卫抛异常时拦截器根本不会执行** —— 于是所有 401 / 403 响应，
 *  以及压根没匹配到路由的 404 响应，traceId 全都是空字符串。
 *
 *  而 traceId 存在的全部意义就是"出错时能对上服务端日志"：
 *  成功响应不带 traceId 没人会抱怨，失败响应不带就等于白做。
 *  一个只在成功路径生效的排查工具，是彻头彻尾的假安全感。
 *
 *  中间件是第一个执行的阶段，放在这里才能覆盖所有出口。
 *
 * ============================================================================
 *  另外两件事
 * ============================================================================
 *  1. 优先复用上游传来的 x-trace-id（网关 / Nginx / 前端）
 *     这样一次用户操作跨多个服务时，链路仍然是串起来的
 *  2. 把 traceId 回写到**响应头**
 *     响应体是给用户看的，响应头是给工具看的（浏览器网络面板、
 *     前端错误上报、APM 探针），两边都有才方便
 */
export function traceIdMiddleware(
  req: Request & WithTraceId,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers[TRACE_ID_HEADER];
  const fromUpstream = Array.isArray(incoming) ? incoming[0] : incoming;

  const traceId =
    (typeof fromUpstream === 'string' && fromUpstream.trim()) ||
    randomUUID().replace(/-/g, '').slice(0, 16);

  req.traceId = traceId;
  res.setHeader(TRACE_ID_HEADER, traceId);

  next();
}

export default traceIdMiddleware;
