import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { clearToken, getToken, setToken } from '@/api/request';

export interface UserInfo {
  id: number;
  username: string;
  nickname: string;
  avatar?: string;
  roles: string[];
}

/**
 * 用户状态
 *
 * 三级权限在前端的落点：
 *   · roles       角色码，用于粗粒度判断
 *   · permissions 权限码集合，用于 v-permission 指令与按钮显隐
 *   · menus       菜单树，用于动态注册路由
 *
 * 超级管理员后端会下发 ['*'] 通配权限，hasPermission 里特判。
 */
export const useUserStore = defineStore('user', () => {
  const token = ref<string>(getToken());
  const userInfo = ref<UserInfo | null>(null);
  const permissions = ref<string[]>([]);
  const roles = ref<string[]>([]);

  const isLoggedIn = computed(() => Boolean(token.value));
  const nickname = computed(() => userInfo.value?.nickname ?? '');

  /** 是否是超级管理员（通配权限） */
  const isSuperAdmin = computed(() => permissions.value.includes('*'));

  function hasPermission(code: string | string[]): boolean {
    if (isSuperAdmin.value) return true;
    const codes = Array.isArray(code) ? code : [code];
    if (codes.length === 0) return true;
    return codes.some((c) => permissions.value.includes(c));
  }

  function hasRole(code: string | string[]): boolean {
    const codes = Array.isArray(code) ? code : [code];
    return codes.some((c) => roles.value.includes(c));
  }

  /** 保存登录结果 */
  function setAuth(payload: {
    token: string;
    userInfo: UserInfo;
    permissions: string[];
    roles: string[];
  }): void {
    token.value = payload.token;
    userInfo.value = payload.userInfo;
    permissions.value = payload.permissions;
    roles.value = payload.roles;
    setToken(payload.token);
  }

  /** 清空本地登录状态（不调接口，登出接口由调用方负责） */
  function reset(): void {
    token.value = '';
    userInfo.value = null;
    permissions.value = [];
    roles.value = [];
    clearToken();
  }

  return {
    token,
    userInfo,
    permissions,
    roles,
    isLoggedIn,
    nickname,
    isSuperAdmin,
    hasPermission,
    hasRole,
    setAuth,
    reset,
  };
});
