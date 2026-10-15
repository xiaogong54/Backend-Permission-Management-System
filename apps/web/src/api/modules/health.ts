import { request } from '../request';

export interface HealthStatus {
  status: 'up' | 'degraded';
  uptime: number;
  timestamp: string;
  database: 'up' | 'down';
}

/**
 * 健康检查
 *
 * 注意这个接口不在 /api/v1 前缀下（后端 setGlobalPrefix 时排除了它），
 * 所以这里要写绝对路径，绕开 axios 实例上的 baseURL。
 */
export function fetchHealth(): Promise<HealthStatus> {
  return request.get<HealthStatus>('/health');
}
