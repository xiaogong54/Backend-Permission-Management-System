/// <reference types="vite/client" />

/**
 * 让 TypeScript 认识 .vue 文件
 * 没有这段，import App from './App.vue' 会报 "找不到模块"
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

/** 本项目用到的环境变量（只声明 VITE_ 前缀的，其余不会暴露给前端） */
interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_TARGET: string;
  /** 开发期跳过登录校验，仅 DEV 生效 */
  readonly VITE_DEV_BYPASS_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
