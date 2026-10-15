import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { ElMessage } from 'element-plus';
import router from '@/router';
import { useUserStore } from '@/store/modules/user';

/**
 * 后端统一响应体，与 apps/server 的 ResponseInterceptor 严格对应
 * 保持前后端各一份、字段名完全一致，是"接口契约"最朴素的落地方式。
 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  traceId: string;
  timestamp?: string;
  path?: string;
}

/** 分页响应体 */
export interface Paginated<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const TOKEN_KEY = 'mall-admin-token';

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

const http: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
});

// ---------------------------------------------------------------------------
// 请求拦截：带上 JWT 与 traceId
// ---------------------------------------------------------------------------
http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const userStore = useUserStore();
    if (userStore.token) {
      config.headers.set('Authorization', `Bearer ${userStore.token}`);
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// 响应拦截：拆掉统一响应体的外壳，业务层直接拿 data
// ---------------------------------------------------------------------------
http.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const body = response.data;

    // 文件下载之类的裸响应（后端用 raw() 标记跳过包装），原样返回
    if (body === null || typeof body !== 'object' || !('code' in body)) {
      return response;
    }

    if (body.code === 0) {
      // 把 data 直接替换到 response.data，业务层写 res.data 拿到的是真正的数据
      response.data = body.data as never;
      return response;
    }

    // 业务失败：统一弹提示，并把错误继续抛出去让调用方决定是否额外处理
    ElMessage.error(body.message || '请求失败');
    return Promise.reject(new Error(`${body.code}: ${body.message}`));
  },

  (error: AxiosError<ApiResponse>) => {
    const status = error.response?.status;
    const body = error.response?.data;

    // traceId 是排查线上问题的关键，出错时打到控制台，用户截图也能带上
    const traceId = body?.traceId ? `（traceId: ${body.traceId}）` : '';

    switch (status) {
      case 401: {
        clearToken();
        ElMessage.error(body?.message || '登录已失效，请重新登录');
        void router.push({ name: 'Login' });
        break;
      }
      case 403:
        ElMessage.error(body?.message || '没有该操作权限');
        break;
      case 404:
        ElMessage.error(body?.message || '请求的资源不存在');
        break;
      case 429:
        ElMessage.warning(body?.message || '操作过于频繁，请稍后再试');
        break;
      default: {
        const msg = body?.message || error.message || '网络异常，请稍后重试';
        ElMessage.error(`${msg}${traceId}`);
      }
    }

    return Promise.reject(error);
  },
);

/**
 * 对外只暴露这四个方法。
 * 返回类型写成 Promise<T>，因为响应拦截器已经把 { code, message, data } 拆成了 data。
 */
export const request = {
  get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    return http.get<T, AxiosResponse<T>>(url, { params }).then((r) => r.data);
  },
  post<T>(url: string, data?: unknown): Promise<T> {
    return http.post<T, AxiosResponse<T>>(url, data).then((r) => r.data);
  },
  put<T>(url: string, data?: unknown): Promise<T> {
    return http.put<T, AxiosResponse<T>>(url, data).then((r) => r.data);
  },
  delete<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    return http.delete<T, AxiosResponse<T>>(url, { params }).then((r) => r.data);
  },
};

export default http;
