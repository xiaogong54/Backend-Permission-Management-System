<script setup lang="ts">
/**
 * 数据看板（骨架）
 *
 * 当前只做两件事：
 *   1. 展示四张指标卡的结构与入场动画（数据是占位）
 *   2. 调用后端 /health 验证「前端 → 代理 → 后端 → MySQL」整条链路是通的
 *
 * 第二个才是脚手架阶段最有价值的东西 —— 它一次性证明
 * Vite 代理、后端启动、Prisma 连库三件事都没问题。
 */
import { onMounted, ref } from 'vue';
import { fetchHealth, type HealthStatus } from '@/api/modules/health';

interface StatCard {
  label: string;
  value: string;
  unit: string;
  icon: string;
  tone: 'blue' | 'green' | 'violet' | 'amber';
  trend: string;
  up: boolean;
}

const stats: StatCard[] = [
  {
    label: '今日订单数',
    value: '1,286',
    unit: '单',
    icon: 'ShoppingCart',
    tone: 'blue',
    trend: '+12.4%',
    up: true,
  },
  {
    label: '今日销售额',
    value: '896,420',
    unit: '元',
    icon: 'Money',
    tone: 'green',
    trend: '+8.7%',
    up: true,
  },
  {
    label: '新增用户',
    value: '342',
    unit: '人',
    icon: 'UserFilled',
    tone: 'violet',
    trend: '+21.9%',
    up: true,
  },
  {
    label: '在售商品',
    value: '1,864',
    unit: '件',
    icon: 'Goods',
    tone: 'amber',
    trend: '-2.1%',
    up: false,
  },
];

const health = ref<HealthStatus | null>(null);
const healthError = ref('');
const loading = ref(true);

async function loadHealth(): Promise<void> {
  loading.value = true;
  healthError.value = '';
  try {
    health.value = await fetchHealth();
  } catch (e) {
    health.value = null;
    healthError.value = (e as Error).message || '请求失败';
  } finally {
    loading.value = false;
  }
}

/** 把秒数格式化成 1h 23m 45s 这种可读形式 */
function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h ? `${h}h` : '', m ? `${m}m` : '', `${s}s`].filter(Boolean).join(' ');
}

onMounted(loadHealth);
</script>

<template>
  <div class="dashboard">
    <header class="page-head">
      <h1>数据看板</h1>
      <p>当前为脚手架阶段，指标为占位数据；下方「链路连通性」是真实的后端请求。</p>
    </header>

    <!-- ---------------- 指标卡（占位数据） ---------------- -->
    <div class="stat-grid stagger">
      <el-card v-for="s in stats" :key="s.label" shadow="hover" class="stat">
        <div class="stat-top">
          <span class="stat-label">{{ s.label }}</span>
          <span class="stat-ic" :class="s.tone">
            <el-icon><component :is="s.icon" /></el-icon>
          </span>
        </div>
        <div class="stat-value tabular-nums">
          {{ s.value }}<span class="unit">{{ s.unit }}</span>
        </div>
        <div class="stat-foot">
          <span class="trend" :class="s.up ? 'up' : 'down'">
            <el-icon><Top v-if="s.up" /><Bottom v-else /></el-icon>
            {{ s.trend }}
          </span>
          <span>较昨日</span>
        </div>
      </el-card>
    </div>

    <!-- ---------------- 链路连通性（真实请求） ---------------- -->
    <el-card shadow="never" class="health-card">
      <template #header>
        <div class="health-head">
          <span class="health-title">链路连通性</span>
          <span class="health-sub">前端 → Vite 代理 → NestJS → Prisma → MySQL</span>
          <el-button link type="primary" :loading="loading" @click="loadHealth">重新检测</el-button>
        </div>
      </template>

      <el-skeleton v-if="loading" :rows="3" animated />

      <el-alert v-else-if="healthError" type="error" :closable="false" show-icon>
        <template #title>后端不可达</template>
        <div class="health-err">
          {{ healthError }}
          <br />
          请确认：① 后端已启动（<code>pnpm --filter @mall-admin/server dev</code>）； ② 本机 MySQL
          已启动；③ <code>apps/server/.env</code> 里的连接串正确。
        </div>
      </el-alert>

      <el-descriptions v-else-if="health" :column="3" border>
        <el-descriptions-item label="服务状态">
          <el-tag :type="health.status === 'up' ? 'success' : 'warning'" size="small">
            {{ health.status === 'up' ? '正常' : '降级' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="数据库">
          <el-tag :type="health.database === 'up' ? 'success' : 'danger'" size="small">
            {{ health.database === 'up' ? 'InnoDB 已连接' : '连接失败' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="运行时长">
          {{ formatUptime(health.uptime) }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- ---------------- 后续待实现 ---------------- -->
    <el-card shadow="never" class="todo-card">
      <template #header><span class="health-title">后续待实现</span></template>
      <ul class="todo-list">
        <li>销售额趋势 / 订单量趋势折线图（ECharts）</li>
        <li>商品销量 TOP10 / 用户消费 TOP10 排行榜</li>
        <li>对应后端接口：<code>GET /api/v1/dashboard/overview</code> 等</li>
      </ul>
    </el-card>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 1440px;
}
.page-head {
  margin-bottom: 20px;
}
.page-head h1 {
  margin: 0 0 5px;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-1);
}
.page-head p {
  margin: 0;
  font-size: 13px;
  color: var(--text-3);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(212px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}
.stat :deep(.el-card__body) {
  padding: 20px;
}
.stat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.stat-label {
  font-size: 13px;
  color: var(--text-3);
}
.stat-ic {
  width: 34px;
  height: 34px;
  border-radius: var(--r-md);
  display: grid;
  place-items: center;
}
.stat-ic.blue {
  background: var(--brand-50);
  color: var(--brand-600);
}
.stat-ic.green {
  background: var(--success-bg);
  color: var(--success);
}
.stat-ic.violet {
  background: #f5f3ff;
  color: #7c3aed;
}
.stat-ic.amber {
  background: var(--warning-bg);
  color: var(--warning);
}
.stat-value {
  font-size: 30px;
  font-weight: 600;
  color: var(--text-1);
  letter-spacing: -0.8px;
  line-height: 1.15;
}
.stat-value .unit {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-3);
  margin-left: 3px;
  letter-spacing: 0;
}
.stat-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-3);
}
.trend {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-weight: 600;
}
.trend.up {
  color: var(--success);
}
.trend.down {
  color: var(--danger);
}

.health-card {
  margin-bottom: 20px;
}
.health-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.health-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
.health-sub {
  font-size: 12px;
  color: var(--text-4);
  margin-right: auto;
}
.health-err {
  font-size: 12px;
  line-height: 1.8;
  margin-top: 4px;
}

.todo-list {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  line-height: 2;
  color: var(--text-3);
}
code {
  font-family: Consolas, monospace;
  background: #f1f5f9;
  padding: 1px 5px;
  border-radius: var(--r-xs);
}
</style>
