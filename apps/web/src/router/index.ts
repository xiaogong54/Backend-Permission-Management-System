import { createRouter, createWebHistory } from 'vue-router';
import { useUserStore } from '@/store/modules/user';
import { constantRoutes } from './routes';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: constantRoutes,
  // 切换路由回到顶部，否则从长列表跳到新页面会停在半中间
  scrollBehavior: () => ({ top: 0 }),
});

/**
 * 全局前置守卫
 *
 * 策略是「默认要求登录」：只有 meta.public === true 的页面才放行。
 * 这样新增页面时如果忘记配置，结果是被拦到登录页（安全的一侧），
 * 而不是裸奔在公网上。
 */
router.beforeEach((to) => {
  const appTitle = import.meta.env.VITE_APP_TITLE;
  document.title = to.meta.title ? `${to.meta.title} · ${appTitle}` : appTitle;

  if (to.meta.public) return true;

  const userStore = useUserStore();
  if (userStore.isLoggedIn) return true;

  /**
   * 开发期临时开关
   *
   * 后端的 auth 模块（登录 / 验证码 / JWT）属于后续阶段，尚未实现。
   * 打开这个开关可以先浏览页面、验证前后端连通性。
   *
   * 两个安全垫：
   *   1. import.meta.env.DEV 在生产构建里是编译期常量 false，
   *      整段判断会被 tree-shaking 掉，生产包不含这个后门
   *   2. 只认 .env.development 里的显式配置，默认关闭
   */
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true') {
    console.warn('[dev] 已开启 VITE_DEV_BYPASS_AUTH，跳过登录校验。仅用于 auth 模块实现前联调。');
    return true;
  }

  return { name: 'Login', query: { redirect: to.fullPath } };
});

export default router;
