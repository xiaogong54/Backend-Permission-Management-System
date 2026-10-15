import type { RouteRecordRaw } from 'vue-router';

/**
 * 扩展路由 meta 的类型
 * 不声明的话，to.meta.title 会是 unknown，模板里用起来很难受
 */
declare module 'vue-router' {
  interface RouteMeta {
    /** 页面标题，用于浏览器标题栏与面包屑 */
    title?: string;
    /** Element Plus 图标组件名 */
    icon?: string;
    /** 是否免登录。默认要求登录（默认拒绝比默认放行安全） */
    public?: boolean;
    /** 是否被 keep-alive 缓存 */
    keepAlive?: boolean;
    /** 菜单里是否隐藏 */
    hidden?: boolean;
  }
}

const Layout = () => import('@/layout/index.vue');

/**
 * 静态路由
 *
 * 后续权限模块做完后，这里只保留"无需权限"的页面（登录、404），
 * 业务页面改为登录后由后端下发菜单树动态生成，追加到 layout 的 children 上。
 * 这就是"动态菜单渲染"的实现路径。
 */
export const constantRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', public: true, hidden: true },
  },
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '数据看板', icon: 'DataLine', keepAlive: true },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面不存在', public: true, hidden: true },
  },
];

export default constantRoutes;
