<script setup lang="ts">
/**
 * 主布局
 *
 * 结构对齐 docs/原型.html：
 *   左侧深色侧边栏（可折叠） + 顶栏（面包屑 / 用户菜单） + 内容区
 *
 * 折叠相关的细节都踩过坑，注释里写清楚了，改的时候别踩回去。
 */
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/store/modules/user';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const collapsed = ref(false);

/** 面包屑：取匹配到的路由链上带 title 的项 */
const breadcrumbs = computed(() =>
  route.matched.filter((r) => r.meta?.title).map((r) => ({ title: r.meta.title as string })),
);

const pageTitle = computed(() => (route.meta.title as string | undefined) ?? '');

function toggleCollapse(): void {
  collapsed.value = !collapsed.value;
}

function handleLogout(): void {
  userStore.reset();
  void router.push({ name: 'Login' });
}
</script>

<template>
  <div class="app-shell" :class="{ collapsed }">
    <!-- ---------------- 侧边栏 ---------------- -->
    <aside class="sidebar">
      <div class="sider-head">
        <div class="sider-logo">
          <el-icon><ShoppingBag /></el-icon>
        </div>
        <span class="sider-title">mall-admin</span>
      </div>

      <el-scrollbar class="sider-nav">
        <el-menu
          :default-active="route.path"
          :collapse="collapsed"
          :collapse-transition="false"
          router
          class="sider-menu"
        >
          <el-menu-item index="/dashboard">
            <el-icon><DataLine /></el-icon>
            <template #title>数据看板</template>
          </el-menu-item>

          <!--
            以下菜单项是占位，等对应业务模块做完后取消注释并接上真实路由。
            保留它们在结构里，是为了让布局的"多级菜单"形态能被直观看到。
          -->
          <el-sub-menu index="product">
            <template #title>
              <el-icon><Goods /></el-icon>
              <span>商品管理</span>
            </template>
            <el-menu-item index="/product/category" disabled>商品分类</el-menu-item>
            <el-menu-item index="/product/spec" disabled>规格管理</el-menu-item>
            <el-menu-item index="/product/spu" disabled>商品列表</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="order">
            <template #title>
              <el-icon><List /></el-icon>
              <span>订单管理</span>
            </template>
            <el-menu-item index="/order/list" disabled>订单列表</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="user">
            <template #title>
              <el-icon><User /></el-icon>
              <span>用户管理</span>
            </template>
            <el-menu-item index="/user/list" disabled>用户列表</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="system">
            <template #title>
              <el-icon><Setting /></el-icon>
              <span>系统管理</span>
            </template>
            <el-menu-item index="/system/admin" disabled>管理员管理</el-menu-item>
            <el-menu-item index="/system/role" disabled>角色管理</el-menu-item>
            <el-menu-item index="/system/permission" disabled>菜单权限</el-menu-item>
            <el-menu-item index="/system/log" disabled>操作日志</el-menu-item>
          </el-sub-menu>
        </el-menu>
      </el-scrollbar>
    </aside>

    <!-- ---------------- 主区 ---------------- -->
    <div class="main">
      <header class="topbar">
        <button class="topbar-btn" title="收起 / 展开侧边栏" @click="toggleCollapse">
          <el-icon><Fold v-if="!collapsed" /><Expand v-else /></el-icon>
        </button>

        <nav class="crumb">
          <span v-for="(item, idx) in breadcrumbs" :key="item.title">
            <span v-if="idx > 0" class="sep">/</span>
            <span :class="idx === breadcrumbs.length - 1 ? 'cur' : ''">{{ item.title }}</span>
          </span>
        </nav>

        <div class="topbar-right">
          <el-dropdown trigger="click" @command="handleLogout">
            <span class="topbar-user">
              <span class="avatar">{{ userStore.nickname || '未登录' }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>个人中心</el-dropdown-item>
                <el-dropdown-item disabled>修改密码</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="content">
        <router-view v-slot="{ Component }">
          <component :is="Component" :key="pageTitle" class="route-enter" />
        </router-view>
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* ---------------- 侧边栏 ---------------- */
.sidebar {
  width: var(--sider-w);
  flex: 0 0 auto;
  background: var(--sider-bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 宽度过渡是折叠动画的核心，别删 */
  transition: width var(--dur-slow) var(--ease);
}
.app-shell.collapsed .sidebar {
  width: var(--sider-w-mini);
}

.sider-head {
  height: var(--topbar-h);
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 19px;
  overflow: hidden;
  white-space: nowrap;
}
.sider-logo {
  width: 27px;
  height: 27px;
  flex: 0 0 auto;
  border-radius: 7px;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(135deg, var(--brand-500), var(--brand-700));
}
.sider-title {
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
  transition: opacity var(--dur-fast) var(--ease);
}
/* 折叠时让文字淡出，而不是被硬切掉 */
.app-shell.collapsed .sider-title {
  opacity: 0;
}

.sider-nav {
  flex: 1;
  min-height: 0;
}
.sider-menu {
  border-right: none;
  background: transparent;
}
.sider-menu :deep(.el-menu-item),
.sider-menu :deep(.el-sub-menu__title) {
  color: var(--sider-text);
  height: 40px;
  line-height: 40px;
  margin: 2px 8px;
  border-radius: var(--r-md);
}
.sider-menu :deep(.el-menu-item:hover),
.sider-menu :deep(.el-sub-menu__title:hover) {
  background: var(--sider-hover-bg);
  color: #f1f5f9;
}
.sider-menu :deep(.el-menu-item.is-active) {
  background: var(--sider-active-bg);
  color: #fff;
  font-weight: 500;
}
.sider-menu :deep(.el-menu) {
  background: transparent;
}

/* ---------------- 主区 ---------------- */
.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.topbar {
  height: var(--topbar-h);
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px;
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
.topbar-btn {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: var(--r-md);
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background var(--dur-fast) var(--ease);
}
.topbar-btn:hover {
  background: #f1f5f9;
  color: var(--text-1);
}

.crumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-3);
}
.crumb .sep {
  margin: 0 4px;
  color: var(--text-4);
}
.crumb .cur {
  color: var(--text-1);
  font-weight: 500;
}

.topbar-right {
  margin-left: auto;
}
.topbar-user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease);
  outline: none;
}
.topbar-user:hover {
  background: #f1f5f9;
}
.avatar {
  display: inline-grid;
  place-items: center;
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, var(--brand-500), var(--brand-700));
}

.content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
  background: var(--bg-page);
}
</style>
