import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  getProfile,
  login as loginApi,
  logout as logoutApi,
  type LoginParams,
  type UserInfo as ApiUserInfo,
} from '@/api/modules/auth';
import { clearToken, getToken, setToken } from '@/utils/token';

/** 用户信息（比接口多几个可选字段，个人中心用） */
export interface UserInfo extends ApiUserInfo {
  email?: string | null;
  phone?: string | null;
}

/**
 * 用户状态
 *
 * 三级权限在前端的落点：
 *   · roles       角色码，用于粗粒度判断
 *   · permissions 权限码集合，用于 v-permission 指令与菜单过滤
 *   · menus       菜单树，用于动态注册路由（后端 /auth/menus 实现后再接）
 *
 * 超级管理员后端下发的是 ['*'] 通配权限，hasPermission 里特判。
 */
export const useUserStore = defineStore('user', () => {
  const token = ref<string>(getToken());
  const userInfo = ref<UserInfo | null>(null);
  const permissions = ref<string[]>([]);
  const roles = ref<string[]>([]);

  /**
   * 是否已经从后端拉过用户信息
   *
   * ★ 这个标记是必需的，原因在于"刷新页面"这个动作：
   *   localStorage 里只存了 token，userInfo / permissions / roles 全在内存里，
   *   一刷新就没了。此时 isLoggedIn 依然是 true（token 还在），
   *   但界面上没有任何权限信息 —— 菜单是空的、按钮全被 v-permission 干掉。
   *
   *   所以路由守卫必须能区分"有 token 但还没拉过用户信息"这种状态，
   *   并在放行前补一次 getProfile()。
   */
  const profileLoaded = ref(false);

  const isLoggedIn = computed(() => Boolean(token.value));
  const nickname = computed(() => userInfo.value?.nickname ?? '');
  const username = computed(() => userInfo.value?.username ?? '');

  /** 是否是超级管理员（通配权限） */
  const isSuperAdmin = computed(() => permissions.value.includes('*'));

  /** 是否有某个权限（数组形式为「或」） */
  function hasPermission(code: string | string[]): boolean {
    if (isSuperAdmin.value) return true;
    const codes = Array.isArray(code) ? code : [code];
    if (codes.length === 0) return true;
    return codes.some((c) => permissions.value.includes(c));
  }

  /** 是否有某个角色 */
  function hasRole(code: string | string[]): boolean {
    const codes = Array.isArray(code) ? code : [code];
    return codes.some((c) => roles.value.includes(c));
  }

  /**
   * 登录：调接口 + 落状态 + 持久化 token
   *
   * @param remember 「记住我」是否勾选，决定 token 存 localStorage 还是 sessionStorage
   */
  async function login(params: LoginParams, remember = true): Promise<void> {
    const res = await loginApi(params);

    token.value = res.token;
    userInfo.value = res.userInfo;
    roles.value = res.roles;
    permissions.value = res.permissions;
    profileLoaded.value = true;
    setToken(res.token, remember);
  }

  /**
   * 拉取当前登录人信息
   *
   * 用在两处：路由守卫发现"有 token 但没用户信息"时（通常是刷新页面），
   * 以及需要强制刷新权限的场景。
   */
  async function fetchProfile(): Promise<void> {
    const res = await getProfile();

    userInfo.value = {
      ...res.userInfo,
    };
    roles.value = res.roles;
    permissions.value = res.permissions;
    profileLoaded.value = true;
  }

  /**
   * 退出登录
   *
   * ★ 无论接口成功与否，本地状态都必须清干净。
   *   如果写成"接口失败就不清本地"，用户会遇到：点了退出登录、
   *   界面还显示已登录、再点一次还是失败 —— 完全卡死。
   *   登出接口失败最多是 token 没被拉黑，本地清掉至少保证界面是对的。
   */
  async function logout(): Promise<void> {
    try {
      await logoutApi();
    } catch {
      // 忽略：本地状态清理在 finally 里一定会执行
    } finally {
      reset();
    }
  }

  /** 清空本地登录状态（纯本地操作，不调接口） */
  function reset(): void {
    token.value = '';
    userInfo.value = null;
    permissions.value = [];
    roles.value = [];
    profileLoaded.value = false;
    clearToken();
  }

  return {
    token,
    userInfo,
    permissions,
    roles,
    profileLoaded,
    isLoggedIn,
    nickname,
    username,
    isSuperAdmin,
    hasPermission,
    hasRole,
    login,
    fetchProfile,
    logout,
    reset,
  };
});
