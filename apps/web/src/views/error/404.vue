<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <div class="not-found">
    <div class="code">404</div>
    <p class="tip">抱歉，你访问的页面不存在或已被移除</p>
    <el-button type="primary" @click="router.push('/')">返回首页</el-button>
  </div>
</template>

<style scoped>
.not-found {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: var(--bg-page);
}
.code {
  font-size: 96px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -4px;
  background: linear-gradient(135deg, var(--brand-400), var(--brand-700));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.tip {
  margin: 0;
  font-size: 14px;
  color: var(--text-3);
}
</style>
