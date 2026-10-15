<script setup lang="ts">
/**
 * 业务模块占位页
 *
 * 这些模块的页面还没实现，但路由与权限配置是**真实生效**的：
 *   · 菜单能点进来（而不是灰着的 disabled 项）
 *   · 没有对应权限的角色会被路由守卫拦到 403
 *   · 页面标题、面包屑都取自真实的 route.meta
 *
 * 模块做出来之后，把 routes.ts 里对应的 component 换成真实页面即可，
 * 权限配置一行都不用改。
 */
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useUserStore } from '@/store/modules/user';

const route = useRoute();
const userStore = useUserStore();

const title = computed(() => (route.meta.title as string | undefined) ?? '未知模块');
const permissionCode = computed(() => route.meta.permission ?? '—');

/** 展示当前账号的下发权限，方便验证"不同角色看到的不一样" */
const myPermissions = computed(() => userStore.permissions);
</script>

<template>
  <div class="placeholder">
    <el-card shadow="never" class="card">
      <div class="head">
        <el-icon :size="30" class="icon"><Tools /></el-icon>
        <div>
          <h2>{{ title }}</h2>
          <p class="sub">该模块的页面尚未实现，路由与权限配置已生效</p>
        </div>
      </div>

      <el-descriptions :column="1" border class="desc">
        <el-descriptions-item label="路由路径">
          <code>{{ route.path }}</code>
        </el-descriptions-item>
        <el-descriptions-item label="页面所需权限">
          <code>{{ permissionCode }}</code>
        </el-descriptions-item>
        <el-descriptions-item label="当前账号角色">
          <el-tag v-for="r in userStore.roles" :key="r" size="small" class="tag">{{ r }}</el-tag>
          <span v-if="userStore.roles.length === 0">—</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="never" class="card">
      <template #header>
        <span class="card-title">当前账号下发的权限码（{{ myPermissions.length }} 项）</span>
      </template>
      <div class="perms">
        <el-tag v-for="p in myPermissions" :key="p" size="small" type="info" class="tag">
          {{ p }}
        </el-tag>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.placeholder {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card {
  border-radius: var(--r-lg);
}
.head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}
.icon {
  color: var(--brand-500);
}
.head h2 {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-1);
}
.sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-3);
}
.desc :deep(code) {
  font-family: Consolas, monospace;
  background: rgba(37, 99, 235, 0.08);
  padding: 2px 6px;
  border-radius: var(--r-xs);
  font-size: 12px;
}
.card-title {
  font-size: 14px;
  font-weight: 600;
}
.perms {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tag {
  margin-right: 6px;
}
</style>
