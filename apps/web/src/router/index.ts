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
 *
 * ★ 关于开发期的 VITE_DEV_BYPASS_AUTH 开关
 *   后端的 auth 模块已经实现，这个后门已经删掉了。
 *   留着"跳过登录"的开关在生产项目里始终是隐患 ——
 *   万一某次构建把 .env.development 的内容带进去了，整套权限就成了摆设。
 *   需要临时绕过时，就用真实账号登录，不再留第二条路。
 */
router.beforeEach(async (to) => {
  const appTitle = import.meta.env.VITE_APP_TITLE;
  document.title = to.meta.title ? `${to.meta.title} · ${appTitle}` : appTitle;

  if (to.meta.public) return true;

  const userStore = useUserStore();

  // ---- 1. 没登录 → 去登录页，并记住原本要去哪 ----
  if (!userStore.isLoggedIn) {
    return { name: 'Login', query: { redirect: to.fullPath } };
  }

  /**
   * ---- 2. 有 token 但还没拉过用户信息 ----
   *
   * ★ 这是「刷新页面」必然走到的分支，也是动态权限最容易漏掉的一步。
   *   localStorage 里只有 token，permissions / roles 全在内存里，刷新就没了。
   *   如果不在这里补一次 getProfile()，用户刷新后虽然"还登录着"，
   *   但菜单是空的、所有按钮都被 v-permission 移除了 —— 表现为"刷新一下就坏了"。
   */
  if (!userStore.profileLoaded) {
    try {
      await userStore.fetchProfile();
    } catch {
      // token 失效 / 账号被禁用 / 账号被删除，都走这里
      userStore.reset();
      return { name: 'Login', query: { redirect: to.fullPath } };
    }
  }

  // ---- 3. 页面级权限 ----
  if (to.meta.permission && !userStore.hasPermission(to.meta.permission)) {
    return { name: 'Forbidden' };
  }

  return true;
});

export default router;
