import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import { createApp } from 'vue';
import App from './App.vue';
import permission from './directives/permission';
import router from './router';
import pinia from './store';

import 'element-plus/dist/index.css';
import './styles/index.css';

/**
 * 应用入口
 *
 * 【关于 Element Plus 的引入方式】
 * 这里用的是整包引入，好处是零配置、开箱即用，ElMessage / ElMessageBox /
 * ElLoading 这些函数式组件也不需要额外处理样式。
 *
 * 代价：产物偏大（约 1MB gzip），与 PRD 里「单页加载 < 2s」有张力。
 * 后续要做按需引入的话，改三处 —— 详见 vite.config.ts 顶部注释。
 *
 * 另外注意：整包引入时，Element Plus 的 CSS 必须在这里显式 import，
 * 否则组件能渲染但完全没有样式，这是个很常见的坑。
 */
const app = createApp(App);

// 全量注册 Element Plus 图标，模板里可以直接写 <el-icon><Search /></el-icon>
// 侧边栏的菜单图标是动态的（<component :is="iconName" />），也依赖这里注册
for (const [name, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(name, component);
}

// 按钮级权限指令 v-permission
app.directive('permission', permission);

app.use(pinia);
app.use(router);
app.use(ElementPlus, { locale: zhCn });

app.mount('#app');
