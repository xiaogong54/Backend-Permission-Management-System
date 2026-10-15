import type { Directive, DirectiveBinding } from 'vue';
import { useUserStore } from '@/store/modules/user';

/**
 * v-permission 按钮级权限指令
 *
 * 用法：
 *   <el-button v-permission="'product:spu:create'">新增</el-button>
 *   <el-button v-permission="['product:spu:update', 'product:spu:create']">编辑</el-button>
 *
 * 数组形式是「或」：任意一个满足即可 —— 与后端 @RequirePermission 的语义保持一致。
 * 前后端对同一件事用同一套规则，才不会出现"前端显示按钮但点了一直 403"。
 *
 * ============================================================================
 *  ★ 这只是一个「体验优化」，不是安全措施
 * ============================================================================
 *  指令做的事是"把没有权限的按钮从 DOM 里移除"。
 *  但任何人都可以打开控制台改内存、或者直接用 Postman 调接口 ——
 *  前端藏按钮**挡不住任何有意为之的越权**。
 *
 *  真正的权限校验只能在服务端（apps/server 的 PermissionGuard）。
 *  前端的价值在于：让用户看不到"点了会失败"的按钮，少一次困惑、少一次无效请求。
 *
 *  把这两件事分清楚很重要 —— 见过太多项目以为"前端藏了就安全了"。
 *
 * ============================================================================
 *  ★ 为什么是移除元素，而不是 v-if / disabled
 * ============================================================================
 *  · disabled：按钮还在，用户会反复点然后困惑，而且改个 DOM 属性就能启用
 *  · v-if：每个使用处都要写 userStore.hasPermission(...)，模板会变得很啰嗦
 *  · 移除元素：模板里一个指令搞定，也不给用户"这按钮只是禁用"的错觉
 *
 *  用 removeChild 而不是 el.style.display = 'none'：
 *  前者是真的不在 DOM 里，后者还能被"审查元素"改回来。
 */
export const permission: Directive<HTMLElement, string | string[]> = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string | string[]>) {
    const userStore = useUserStore();

    if (!userStore.hasPermission(binding.value)) {
      el.parentNode?.removeChild(el);
    }
  },
};

export default permission;
