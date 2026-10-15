# mall-admin · 电商后台管理系统（商家管理端）

面向中小型电商商家的轻量化后台。**只做商家管理端，不做 C 端商城**，目标是跑通「商品上架 → 用户下单 → 订单履约 → 数据复盘」这条电商核心业务闭环。

## 技术栈

| 层     | 选型                                                                       |
| ------ | -------------------------------------------------------------------------- |
| 前端   | Vue 3 + TypeScript + Vite + Element Plus + Pinia + Vue Router + ECharts    |
| 后端   | NestJS 11 + TypeScript + Prisma 7 + JWT + Redis                            |
| 数据库 | MySQL 8.0（utf8mb4 / utf8mb4_unicode_ci）                                  |
| 工程化 | pnpm workspace 单仓 + Docker Compose + ESLint + Prettier + Swagger + Husky |

## 目录结构

```
mall-admin/
├─ apps/
│  ├─ server/                  # NestJS 后端
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma      # 数据模型唯一真源
│  │  │  └─ migrations/        # 迁移 SQL（必须入库）
│  │  ├─ prisma7.config.ts     # Prisma 7 的迁移配置（连接串在这里）
│  │  └─ src/
│  │     ├─ common/            # 异常、过滤器、拦截器、装饰器、DTO
│  │     ├─ config/            # 配置加载
│  │     ├─ modules/           # 业务模块（按业务域分包）
│  │     ├─ prisma/            # 数据访问层
│  │     └─ generated/         # Prisma 生成的客户端（产物，不入库）
│  └─ web/                     # Vue 3 前端
│     └─ src/
│        ├─ api/               # 请求封装与接口定义
│        ├─ layout/            # 主布局
│        ├─ router/            # 路由与守卫
│        ├─ store/             # Pinia 状态
│        ├─ styles/            # 设计令牌与全局样式
│        └─ views/             # 页面
├─ packages/
│  └─ shared/                  # 前后端共用的类型、枚举、常量
├─ docs/
│  ├─ 设计概览.md               # 需求与设计汇总
│  └─ 原型.html                 # 视觉风格与交互动效原型
├─ db/                         # 数据库脚本（预留）
├─ docker-compose.yml          # MySQL + Redis
├─ pnpm-workspace.yaml         # 工作区与 pnpm 配置
└─ .env.example                # 环境变量模板（各 app 下另有各自的）
```

## 快速开始

### 前置要求

- **Node.js ≥ 20**（当前开发环境 v24）
- **pnpm ≥ 9**（当前 10.22）
- **MySQL 8.0**（本机已装，或用仓库里的 `docker-compose.yml`）

### 1. 安装依赖

```bash
pnpm install
```

> `pnpm-workspace.yaml` 里的 `onlyBuiltDependencies` 放行了 `@prisma/engines`、`prisma`、`esbuild`
> 的安装脚本。pnpm 10 默认禁止依赖执行 postinstall（供应链安全），不放行会装出残缺的包。

### 2. 准备数据库

**方式 A：使用本机已安装的 MySQL**（当前项目就是这么跑的）

确认 MySQL 已启动，然后建库：

```sql
CREATE DATABASE mall_admin
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

**方式 B：使用 Docker Compose**

```bash
pnpm db:up
```

⚠️ 容器内的 3306 映射到宿主机的 **3307**（因为 3306 通常已被本机 MySQL 占用）。
用这套时要把 `apps/server/.env` 里的端口改成 3307。

### 3. 配置环境变量

```bash
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env.development
```

`.env` 已被 `.gitignore` 排除，**绝不会入库**。

### 4. 建表

```bash
pnpm --filter @mall-admin/server prisma:migrate
```

### 5. 启动

```bash
pnpm dev        # 同时起前后端
```

| 服务     | 地址                              |
| -------- | --------------------------------- |
| 前端     | http://localhost:5173             |
| 后端     | http://localhost:3000/api/v1      |
| 健康检查 | http://localhost:3000/health      |
| 接口文档 | http://localhost:3000/api/v1/docs |

## 常用脚本

在仓库根目录执行：

| 命令                     | 作用                                      |
| ------------------------ | ----------------------------------------- |
| `pnpm dev`               | 并行启动前后端（含 shared 的 watch 编译） |
| `pnpm build`             | 按依赖顺序构建全部包                      |
| `pnpm lint`              | 全部包执行 ESLint                         |
| `pnpm typecheck`         | 全部包执行类型检查                        |
| `pnpm format`            | Prettier 格式化                           |
| `pnpm db:up` / `db:down` | 启停 Docker 里的 MySQL + Redis            |

单个包：

```bash
pnpm --filter @mall-admin/server dev
pnpm --filter @mall-admin/web dev
pnpm --filter @mall-admin/server prisma:studio
```

## 工程约定

### 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)，由 commitlint 在 `commit-msg` 钩子里强制校验：

```
feat(server): 新增管理员登录接口
fix(web): 修复侧边栏折叠后图标未居中
docs: 补充数据库设计说明
```

`pre-commit` 钩子会对改动的文件跑 Prettier。紧急情况用 `git commit --no-verify` 跳过。

### 代码风格

- **字段命名**：Prisma 层用 camelCase，用 `@map` 映射到数据库的 snake_case 列名
- **设计令牌**：颜色、圆角、阴影、动效时长一律走 `apps/web/src/styles/tokens.css` 里的 CSS 变量，组件样式里不写魔数
- **响应结构**：所有接口返回 `{ code, message, data, traceId }`，`code = 0` 表示成功
- **异常处理**：业务错误抛 `BizException(ErrorCode.XXX)`，由全局过滤器统一转换
- **权限声明**：接口用 `@RequirePermission('模块:资源:动作')`，免登录接口用 `@Public()`

### 数据库约定

- 金额一律 `DECIMAL`，禁止 `FLOAT` / `DOUBLE`
- 时间用 `DATETIME`，不用 `TIMESTAMP`（避开 2038 与隐式时区转换）
- 主数据用 `deletedAt` 软删除，唯一索引把 `deletedAt` 纳入联合列
- **不使用数据库外键**（`relationMode = "prisma"`），引用完整性由 Service 层保证

## 当前进度

- [x] 仓库骨架与包管理（pnpm workspace 单仓）
- [x] 后端脚手架（NestJS 11 + Prisma 7 + 统一响应体 + 全局异常 + Swagger）
- [x] 数据库第一版（系统权限域 6 张表，已迁移）
- [x] 前端脚手架（Vue 3 + Vite + Element Plus + Pinia + Router）
- [x] 共享包与工程化（类型共享、ESLint/Prettier、Husky、Docker Compose）
- [ ] 系统权限模块（登录、验证码、JWT、管理员/角色/菜单、操作日志）
- [ ] 商品模块（二级分类、规格、SPU/SKU、上下架）
- [ ] 订单模块（列表、详情、状态机、Excel 导出）
- [ ] 用户模块与数据看板
- [ ] 剩余页面与图表

## 已知待办

| 项                    | 说明                                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Element Plus 整包引入 | 产物偏大（约 1MB gzip），与「单页加载 < 2s」有张力。升级为按需引入的改法写在 `apps/web/vite.config.ts` 顶部注释里 |
| 登录接口未实现        | 后端 auth 模块尚未开发，开发期靠 `VITE_DEV_BYPASS_AUTH=true` 浏览页面                                             |
| 数据库仅第一版        | 商品域、订单域、用户域的表还没建                                                                                  |

## 相关文档

- [设计概览](docs/设计概览.md) —— 数据模型、权限模型、接口总览、订单状态机
- [视觉与动效原型](docs/原型.html) —— 双击用浏览器打开，含动效演示台
