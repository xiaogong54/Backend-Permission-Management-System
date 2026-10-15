import { createPinia } from 'pinia';

/**
 * Pinia 实例
 *
 * 单独抽成模块而不是在 main.ts 里直接 createPinia()，
 * 是为了让 router 守卫、axios 拦截器这些"组件之外"的地方也能拿到同一个实例。
 */
const pinia = createPinia();

export default pinia;

// 统一导出各业务 store，业务代码 import { useUserStore } from '@/store' 即可
export { useUserStore } from './modules/user';
