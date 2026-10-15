<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <div class="forbidden">
    <div class="code">403</div>
    <p class="tip">你没有访问该页面的权限</p>
    <p class="sub">如果认为这是配置错误，请联系管理员检查你的角色授权</p>
    <el-button type="primary" @click="router.push('/')">返回首页</el-button>
  </div>
</template>

<style scoped>
.forbidden {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--bg-page);
}
.code {
  font-size: 96px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -4px;
  /* 用琥珀色区分 403 与 404，一眼能看出是"权限不足"而不是"页面不存在" */
  background: linear-gradient(135deg, #fbbf24, #d97706);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.tip {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-1);
}
.sub {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--text-3);
}
</style>
