import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { ElMessage } from 'element-plus';
import router from '@/router';
import { useUserStore } from '@/store/modules/user';
import { clearToken, getToken } from '@/utils/token';

// 兼容旧的导入路径：以前 getToken/setToken/clearToken 就定义在本文件里
export { clearToken, getToken, setToken } from '@/utils/token';

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

const http: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
});

/**
 * 会话失效的处理中标记
 *
 * 页面初始化时可能同时发出多个请求，如果 token 过期，它们会**同时**收到 401。
 * 不加这个标记就会出现：弹三次"登录已失效"、跳转三次登录页。
 * 这是并发场景下很典型的一类问题 —— 单请求测试永远发现不了。
 */
let handlingSessionExpiry = false;

// ---------------------------------------------------------------------------
// 请求拦截：带上 JWT
// ---------------------------------------------------------------------------
http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // ★ 直接从 localStorage 读，而不是从 Pinia store 读。
    //   目的是让 request.ts 不再依赖 store —— 详见 utils/token.ts 顶部关于循环依赖的说明。
    const token = getToken();
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
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

    // HTTP 200 但业务码非 0：统一弹提示，并把错误继续抛出去让调用方决定是否额外处理
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
        /**
         * ★ 必须区分「登录接口的 401」和「会话过期的 401」
         *
         *   两者 HTTP 状态码相同，含义完全不同：
         *     · POST /auth/login 的 401 = 账号/密码/验证码不对
         *     · 其它接口的 401        = token 无效或已过期
         *
         *   如果不区分，用户只是输错一次密码，就会被"清空登录状态 + 跳转登录页"，
         *   而此刻他本来就在登录页 —— 表现为页面莫名闪烁、表单状态被清掉。
         */
        const isLoginRequest = (error.config?.url ?? '').includes('/auth/login');

        if (isLoginRequest) {
          ElMessage.error(body?.message || '账号或密码错误');
          break;
        }

        if (handlingSessionExpiry) break;
        handlingSessionExpiry = true;

        clearToken();
        // 同时清掉内存里的用户信息与权限，否则界面上还留着上一个账号的菜单和按钮
        useUserStore().reset();
        ElMessage.error(body?.message || '登录已失效，请重新登录');

        void router
          .push({
            name: 'Login',
            // 带上当前位置，登录成功后回到原页面
            query: { redirect: router.currentRoute.value.fullPath },
          })
          .finally(() => {
            handlingSessionExpiry = false;
          });
        break;
      }
      case 403:
        // 后端会把"需要哪个权限码"放进 message，直接展示给使用者最省沟通成本
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
