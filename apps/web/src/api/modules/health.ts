import http from '../request';

export interface HealthStatus {
  status: 'up' | 'degraded';
  uptime: number;
  timestamp: string;
  database: 'up' | 'down';
}

/**
 * 健康检查
 *
 * ⚠️ 这个接口**不在 /api/v1 前缀下** —— 后端 setGlobalPrefix 时把它排除了，
 * 目的是让容器编排的探针不必知道 API 版本号就能探活。
 *
 * 因此这里必须用 { baseURL: '' } 显式覆盖掉 axios 实例上的 /api/v1。
 * 只写 '/health' 是不够的：axios 会把 baseURL 拼在前面，
 * 实际请求会变成 /api/v1/health → 404。
 *
 * 对应的，vite.config.ts 里也为 /health 单独配了一条代理规则。
 */
export function fetchHealth(): Promise<HealthStatus> {
  return http.get<HealthStatus>('/health', { baseURL: '' }).then((r) => r.data);
}
