<script setup lang="ts">
/**
 * 主布局
 *
 * 结构对齐 docs/原型.html：
 *   左侧深色侧边栏（可折叠） + 顶栏（面包屑 / 用户菜单） + 内容区
 *
 * ★ 侧边栏是从**路由表**动态生成的，不再手写菜单项
 *   路由表已经是"系统里有哪些页面"的唯一事实来源。
 *   再手抄一份菜单结构，就会出现"加了路由忘了加菜单"或者
 *   "菜单指向一个已改名的路由"这类问题，而且不会有任何报错 ——
 *   点进去是 404 才会发现。
 *
 *   这里只补充路由表表达不了的两样东西：分组（MENU_GROUPS）与组内排序（meta.order）。
 */
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { constantRoutes, MENU_GROUPS, type MenuGroup } from '@/router/routes';
import { useUserStore } from '@/store/modules/user';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const collapsed = ref(false);
const loggingOut = ref(false);

/** 一个菜单项 */
interface MenuItem {
  path: string;
  title: string;
  icon: string;
}

/** 一个菜单分组 */
interface MenuSection extends MenuGroup {
  children: MenuItem[];
}

/**
 * 构建侧边栏
 *
 * 三步：按分组归类 → 按权限过滤 → 排序
 *
 * ★ 权限过滤是**前端体验**，不是安全边界
 *   没有权限的菜单不显示，用户就不会点进去看到 403。
 *   但直接敲 URL 依然会进到路由守卫，被拦到 403 页面 ——
 *   两层各司其职：菜单过滤负责"别让用户困惑"，路由守卫负责"别让用户进来"。
 */
const menuSections = computed<MenuSection[]>(() => {
  // 取 Layout 路由（path 为 '/'）下的所有子路由
  const layoutRoute = constantRoutes.find((r) => r.path === '/');
  const children = layoutRoute?.children ?? [];

  const sections: MenuSection[] = [];

  for (const group of MENU_GROUPS) {
    const children0: MenuItem[] = children
      .filter((c) => c.meta?.group === group.key && !c.meta.hidden)
      .filter((c) => {
        const permission = c.meta?.permission;
        // 没声明 permission 的页面 = 所有登录用户可见
        return !permission || userStore.hasPermission(permission);
      })
      .sort((a, b) => (a.meta?.order ?? 0) - (b.meta?.order ?? 0))
      .map((c) => ({
        // 子路由的 path 是相对写法（如 'product/spu'），拼成绝对路径给菜单用
        path: `/${String(c.path)}`,
        title: c.meta?.title ?? '',
        icon: c.meta?.icon ?? 'Menu',
      }));

    if (children0.length > 0) {
      sections.push({ ...group, children: children0 });
    }
  }

  return sections.sort((a, b) => a.order - b.order);
});

/** 面包屑：分组名 + 页面名 */
const breadcrumbs = computed<string[]>(() => {
  const items: string[] = [];
  const group = MENU_GROUPS.find((g) => g.key === route.meta.group);
  const title = route.meta.title;

  // 分组与页面同名时不重复显示（例如"数据看板"）
  if (group && group.title !== title) items.push(group.title);
  if (title) items.push(title);

  return items;
});

const pageTitle = computed(() => (route.meta.title as string | undefined) ?? '');

/** 头像文字：取昵称首字，比显示全名更省空间 */
const avatarText = computed(() => (userStore.nickname || userStore.username || '?').slice(0, 1));

function toggleCollapse(): void {
  collapsed.value = !collapsed.value;
}

/**
 * 退出登录
 *
 * 后端会把当前 token 的 jti 加入黑名单，所以退出是**真的退出** ——
 * 即便有人捡到 token，也用不了了。
 */
async function handleLogout(): Promise<void> {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      type: 'warning',
      confirmButtonText: '退出登录',
      cancelButtonText: '取消',
    });
  } catch {
    // 用户点了取消，什么都不做
    return;
  }

  loggingOut.value = true;
  try {
    await userStore.logout();
    ElMessage.success('已退出登录');
    await router.replace({ name: 'Login' });
  } finally {
    loggingOut.value = false;
  }
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
          <template v-for="section in menuSections" :key="section.key">
            <!-- 分组里只有一个页面时不做二级菜单，直接平铺，少一层点击 -->
            <el-menu-item v-if="section.children.length === 1" :index="section.children[0].path">
              <el-icon><component :is="section.icon" /></el-icon>
              <template #title>{{ section.children[0].title }}</template>
            </el-menu-item>

            <el-sub-menu v-else :index="section.key">
              <template #title>
                <el-icon><component :is="section.icon" /></el-icon>
                <span>{{ section.title }}</span>
              </template>
              <el-menu-item v-for="item in section.children" :key="item.path" :index="item.path">
                <el-icon><component :is="item.icon" /></el-icon>
                <template #title>{{ item.title }}</template>
              </el-menu-item>
            </el-sub-menu>
          </template>
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
          <span v-for="(item, idx) in breadcrumbs" :key="item">
            <span v-if="idx > 0" class="sep">/</span>
            <span :class="idx === breadcrumbs.length - 1 ? 'cur' : ''">{{ item }}</span>
          </span>
        </nav>

        <div class="topbar-right">
          <el-tag v-if="userStore.isSuperAdmin" size="small" type="warning" class="role-tag">
            超级管理员
          </el-tag>
          <el-tag v-else-if="userStore.roles.length" size="small" class="role-tag">
            {{ userStore.roles[0] }}
          </el-tag>

          <el-dropdown trigger="click">
            <span class="topbar-user">
              <span class="avatar">{{ avatarText }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <div class="user-card">
                  <div class="user-name">{{ userStore.nickname || '未登录' }}</div>
                  <div class="user-account">@{{ userStore.username }}</div>
                </div>
                <el-dropdown-item divided disabled>个人中心</el-dropdown-item>
                <el-dropdown-item disabled>修改密码</el-dropdown-item>
                <el-dropdown-item divided :disabled="loggingOut" @click="handleLogout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
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
  display: flex;
  align-items: center;
  gap: 10px;
}
.role-tag {
  font-weight: 500;
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
  width: 28px;
  height: 28px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, var(--brand-500), var(--brand-700));
}

/* 下拉里的账号信息卡片 */
.user-card {
  padding: 8px 16px 6px;
  min-width: 160px;
}
.user-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.user-account {
  font-size: 12px;
  color: var(--text-4);
  margin-top: 2px;
}

.content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
  background: var(--bg-page);
}
</style>
