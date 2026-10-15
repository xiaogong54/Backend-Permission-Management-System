<script setup lang="ts">
/**
 * 登录页
 *
 * 对齐 docs/原型.html 的左右分栏：左侧品牌区 + 右侧表单。
 *
 * 【当前状态】后端 auth 模块尚未实现，调用 /auth/login 会返回 404。
 * 表单校验、错误抖动、验证码刷新这些交互已经就位，
 * 等 auth 模块做完，把 login() 里的 TODO 换成真实请求即可。
 */
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { useUserStore } from '@/store/modules/user';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const formRef = ref<FormInstance>();
const submitting = ref(false);
const shaking = ref(false);

const form = reactive({
  username: '',
  password: '',
  captcha: '',
  remember: true,
});

const rules: FormRules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  captcha: [{ required: true, message: '请输入验证码', trigger: 'blur' }],
};

/** 验证码图片（后端 svg-captcha 返回的 SVG 字符串），auth 模块做完后接上 */
const captchaSvg = ref('');

function refreshCaptcha(): void {
  // TODO(auth 模块): 调 GET /auth/captcha 拿 { captchaId, svg }
  captchaSvg.value = '';
}

function triggerShake(): void {
  shaking.value = false;
  // 强制重排，让动画能被重复触发
  void document.body.offsetWidth;
  shaking.value = true;
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return;

  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) {
    triggerShake();
    return;
  }

  submitting.value = true;
  try {
    // TODO(auth 模块): 换成真实请求
    //   const res = await login({ username, password, captchaId, captcha })
    //   userStore.setAuth(res)
    await Promise.resolve();

    ElMessage.warning(
      '登录接口属于 auth 模块，尚未实现。请先在 .env.development 里开启 VITE_DEV_BYPASS_AUTH 浏览页面。',
    );
    triggerShake();
  } finally {
    submitting.value = false;
  }
}

function fillDemo(): void {
  form.username = 'admin';
  form.password = 'Admin@123456';
  form.captcha = 'DEMO';
}

onMounted(() => {
  refreshCaptcha();
  // 从守卫跳转过来时带了 redirect，登录成功后回到原页面
  if (route.query.redirect) {
    console.info('[login] 登录成功后将回到:', route.query.redirect);
  }
  void userStore;
  void router;
});
</script>

<template>
  <div class="login-screen">
    <!-- ---------------- 左侧品牌区 ---------------- -->
    <section class="brand">
      <div class="orb orb-a" />
      <div class="orb orb-b" />

      <div class="brand-inner">
        <div class="brand-mark">
          <div class="brand-logo">
            <el-icon :size="24"><ShoppingBag /></el-icon>
          </div>
          <div class="brand-name">
            mall-admin
            <small>MERCHANT CONSOLE</small>
          </div>
        </div>

        <h1 class="brand-title">轻量化的<br />电商商家管理后台</h1>
        <p class="brand-sub">
          从商品上架到订单履约，一套系统跑通电商经营闭环。三级权限管控、SPU/SKU
          分层模型、实时数据看板。
        </p>

        <ul class="brand-feats">
          <li>
            <el-icon><Lock /></el-icon>细粒度三级权限 · 页面 / 按钮 / 接口
          </li>
          <li>
            <el-icon><Grid /></el-icon>SPU / SKU 分层商品模型
          </li>
          <li>
            <el-icon><TrendCharts /></el-icon>经营数据可视化看板
          </li>
        </ul>
      </div>
    </section>

    <!-- ---------------- 右侧表单区 ---------------- -->
    <section class="form-side">
      <div class="form-card" :class="{ shake: shaking }" @animationend="shaking = false">
        <h2>欢迎回来</h2>
        <p class="sub">请登录你的商家管理账号</p>

        <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent>
          <el-form-item prop="username">
            <el-input v-model="form.username" placeholder="请输入管理员账号" clearable>
              <template #prefix
                ><el-icon><User /></el-icon
              ></template>
            </el-input>
          </el-form-item>

          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              show-password
            >
              <template #prefix
                ><el-icon><Lock /></el-icon
              ></template>
            </el-input>
          </el-form-item>

          <el-form-item prop="captcha">
            <div class="captcha-row">
              <el-input v-model="form.captcha" placeholder="4 位字符" maxlength="4" />
              <div class="captcha-box" title="点击刷新验证码" @click="refreshCaptcha">
                <span v-if="!captchaSvg" class="captcha-ph">验证码</span>
                <!-- eslint-disable-next-line vue/no-v-html -- 内容是本后端 svg-captcha 返回的 SVG，不是用户输入 -->
                <span v-else v-html="captchaSvg" />
              </div>
            </div>
          </el-form-item>

          <div class="meta">
            <el-checkbox v-model="form.remember">记住我</el-checkbox>
            <a href="#" @click.prevent>忘记密码？</a>
          </div>

          <el-button
            type="primary"
            class="submit"
            size="large"
            :loading="submitting"
            @click="handleSubmit"
          >
            登 录
          </el-button>
        </el-form>

        <el-alert type="info" :closable="false" class="hint">
          <template #default>
            演示账号 <code>admin</code> / <code>Admin@123456</code>
            <el-button link type="primary" @click="fillDemo">一键填充</el-button>
          </template>
        </el-alert>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login-screen {
  display: flex;
  height: 100vh;
}

/* ---------------- 左侧品牌区 ---------------- */
.brand {
  flex: 1 1 56%;
  position: relative;
  overflow: hidden;
  color: #f8fafc;
  display: flex;
  align-items: center;
  padding: 0 clamp(40px, 7vw, 104px);
  background: linear-gradient(140deg, #1e3a8a 0%, #1d4ed8 42%, #2563eb 72%, #3b82f6 100%);
}
/* 网格底纹 */
.brand::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.07) 1px, transparent 1px);
  background-size: 52px 52px;
  mask-image: radial-gradient(ellipse 90% 70% at 30% 40%, #000 20%, transparent 78%);
}
/* 漂浮光斑 */
.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(52px);
  opacity: 0.5;
  pointer-events: none;
}
.orb-a {
  width: 420px;
  height: 420px;
  background: #60a5fa;
  top: -120px;
  right: -90px;
  animation: float 17s var(--ease) infinite;
}
.orb-b {
  width: 320px;
  height: 320px;
  background: #818cf8;
  bottom: -110px;
  left: -70px;
  animation: float 21s var(--ease) infinite reverse;
}
@keyframes float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(26px, -32px) scale(1.07);
  }
  66% {
    transform: translate(-22px, 20px) scale(0.95);
  }
}

.brand-inner {
  position: relative;
  z-index: 2;
  max-width: 520px;
}
.brand-mark {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 40px;
}
.brand-logo {
  width: 44px;
  height: 44px;
  border-radius: var(--r-lg);
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.24);
}
.brand-name {
  font-size: 20px;
  font-weight: 600;
}
.brand-name small {
  display: block;
  font-size: 12px;
  font-weight: 400;
  opacity: 0.62;
  letter-spacing: 1.6px;
  margin-top: 2px;
}
.brand-title {
  font-size: clamp(30px, 3.4vw, 44px);
  line-height: 1.24;
  font-weight: 600;
  letter-spacing: -0.5px;
  margin: 0 0 16px;
}
.brand-sub {
  font-size: 16px;
  line-height: 1.75;
  opacity: 0.76;
  margin: 0 0 40px;
  max-width: 440px;
}
.brand-feats {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.brand-feats li {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  opacity: 0.92;
}

/* ---------------- 右侧表单区 ---------------- */
.form-side {
  flex: 1 1 44%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  overflow-y: auto;
  background: var(--bg-card);
}
.form-card {
  width: 100%;
  max-width: 364px;
}
.form-card h2 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-1);
}
.form-card .sub {
  margin: 0 0 32px;
  font-size: 14px;
  color: var(--text-3);
}

@keyframes shake {
  10%,
  90% {
    transform: translateX(-2px);
  }
  20%,
  80% {
    transform: translateX(4px);
  }
  30%,
  50%,
  70% {
    transform: translateX(-7px);
  }
  40%,
  60% {
    transform: translateX(7px);
  }
}
.shake {
  animation: shake 480ms var(--ease);
}

.captcha-row {
  display: flex;
  gap: 12px;
  width: 100%;
}
.captcha-box {
  width: 112px;
  height: 40px;
  flex: 0 0 auto;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: #f1f5f9;
  display: grid;
  place-items: center;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-4);
  overflow: hidden;
  transition:
    border-color var(--dur-fast) var(--ease),
    transform var(--dur-fast) var(--ease);
}
.captcha-box:hover {
  border-color: var(--brand-400);
}
.captcha-box:active {
  transform: scale(0.97);
}

.meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  font-size: 13px;
}
.submit {
  width: 100%;
}
.hint {
  margin-top: 24px;
}
.hint code {
  font-family: Consolas, monospace;
  background: rgba(37, 99, 235, 0.1);
  padding: 2px 5px;
  border-radius: var(--r-xs);
}

@media (max-width: 1080px) {
  .brand {
    display: none;
  }
  .form-side {
    flex: 1 1 100%;
  }
}
</style>
