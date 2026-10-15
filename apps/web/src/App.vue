<script setup lang="ts">
/**
 * 根组件
 *
 * 只做一件事：渲染路由出口。
 * 布局（侧边栏 / 顶栏 / 标签页）由 layout/index.vue 负责，
 * 登录页等无布局页面走 routes.ts 里的独立分支。
 */
import { ElConfigProvider } from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
</script>

<template>
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>
