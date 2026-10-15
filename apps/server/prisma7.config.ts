// ============================================================================
//  Prisma 7 配置文件
// ----------------------------------------------------------------------------
//  Prisma 7 把连接串从 schema 里挪了出来，分成两条路：
//    · 迁移（migrate / db pull / studio）走这里 —— 本文件
//    · 运行时查询走 driver adapter —— 见 src/prisma/prisma.service.ts
//
//  为什么文件名是 prisma7.config.ts 而不是 prisma.config.ts：
//    Prisma 7.10 起用这个名字，避免和 Prisma 8 的配置格式冲突。
//    Prisma 7 的 CLI 两个名字都能识别。
// ============================================================================
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // 为什么是 nest build && node dist/... 而不是 tsx prisma/seed.ts：
    //   本项目没装 tsx，而 seed 脚本要 import 生成到 src/generated 的 Prisma 客户端，
    //   那份代码内部用的是 `.js` 后缀导入（ESM 风格），ts-node 在 CJS 下解析不了。
    //   直接复用 nest build 这条已验证过的编译链路最稳，代价只是多花几秒编译。
    seed: 'nest build && node dist/prisma/seed.js',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
