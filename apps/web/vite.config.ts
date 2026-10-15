import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';

/**
 * Vite 配置
 *
 * 【关于 Element Plus 的引入方式】
 * 当前用的是整包引入（见 src/main.ts），配置零风险、开箱即用。
 * 代价是产物体积偏大，与 PRD 里「单页加载 < 2s」的目标有张力。
 *
 * 后续优化成按需引入的话，改动如下（三处）：
 *   1. 装依赖：pnpm add -D unplugin-auto-import unplugin-vue-components
 *   2. 本文件顶部加：
 *        import AutoImport from 'unplugin-auto-import/vite';
 *        import Components from 'unplugin-vue-components/vite';
 *        import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
 *      plugins 数组里加：
 *        AutoImport({ imports: ['vue','vue-router','pinia'], resolvers: [ElementPlusResolver()] }),
 *        Components({ resolvers: [ElementPlusResolver()] }),
 *   3. main.ts 里删掉 ElementPlus 与 index.css 的整包引入；
 *      同时把 package.json 的 build 脚本改成 "vite build && vue-tsc --noEmit"
 *      —— 因为两个插件生成的 auto-imports.d.ts / components.d.ts 要等首次
 *         构建之后才存在，先跑 vue-tsc 会失败。
 *
 * 【关于开发代理】
 * 前端跑 5173，后端跑 3000。走 Vite 代理而不是前端直连跨域，
 * 好处是前端代码里统一写相对路径 /api/v1/xxx，
 * 部署时换成 Nginx 反代即可，业务代码一行不用改。
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:3000';

  return {
    plugins: [vue()],

    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },

    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },

    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      chunkSizeWarningLimit: 1024,
      rollupOptions: {
        output: {
          // 把体积大、很少变动的库拆成独立 chunk，利用浏览器长缓存
          manualChunks: {
            vue: ['vue', 'vue-router', 'pinia'],
            'element-plus': ['element-plus', '@element-plus/icons-vue'],
            echarts: ['echarts'],
          },
        },
      },
    },
  };
});
