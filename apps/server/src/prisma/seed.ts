import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../generated/prisma/client';

/**
 * 数据库种子脚本
 *
 * 运行方式：
 *   pnpm --filter @mall-admin/server db:seed
 * 或在 prisma migrate reset 之后自动执行（配置在 prisma7.config.ts 的 migrations.seed）
 *
 * ============================================================================
 *  三条设计原则
 * ============================================================================
 *
 * 1. 密码绝不硬编码哈希
 *    bcrypt.hash() 在运行时生成，明文从环境变量读。
 *    硬编码哈希的问题：一旦这个仓库被 fork、被分享，那个哈希就永久留在 Git 历史里，
 *    而且它对应的是一个真实可用的口令。运行时生成的代价只是启动慢几十毫秒。
 *
 * 2. 必须幂等
 *    seed 会被反复执行（migrate reset 后、换机器、CI 里）。
 *    不幂等的话第二次跑就报唯一键冲突，还得手动清库。
 *    所以统一用「先查再改/建」，而不是无脑 create。
 *
 * 3. 不用 upsert，用 findFirst + create/update
 *    原因见下面 upsertRole 的注释 —— 这条和我们的软删除设计直接相关。
 */

/** BCrypt 成本因子。10 ≈ 单次约 100ms，是安全性与登录延迟的常用平衡点 */
const BCRYPT_ROUNDS = 10;

/**
 * 初始管理员的账号与口令
 * 默认值只用于本地开发。生产环境务必通过环境变量覆盖，
 * 并提醒使用者首次登录后立刻改密（sys_admin.pwd_updated_at 就是为此预留的）。
 */
const ADMIN_USERNAME = process.env.INIT_ADMIN_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.INIT_ADMIN_PASSWORD ?? 'Admin@123456';

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER ?? 'root',
    password: process.env.DATABASE_PASSWORD ?? '',
    database: process.env.DATABASE_NAME ?? 'mall_admin',
    connectionLimit: 1,
  }),
});

/** 三个内置角色，与 docs/设计概览.md 一致 */
const ROLES = [
  {
    code: 'SUPER_ADMIN',
    name: '超级管理员',
    description: '拥有系统全部权限，可管理账号、角色与权限配置',
    sort: 1,
  },
  {
    code: 'OPERATOR',
    name: '运营管理员',
    description: '负责商品维护、订单处理与用户管理，无系统配置权限',
    sort: 2,
  },
  {
    code: 'DATA_ADMIN',
    name: '数据管理员',
    description: '仅可查看数据看板与业务列表，可导出报表，无任何写权限',
    sort: 3,
  },
] as const;

/**
 * 按 code 查角色，有则更新、无则创建
 *
 * ★ 为什么不用 prisma.sysRole.upsert({ where: { code } })
 *   因为我们的唯一约束是 @@unique([code, deletedAt]) 这个**联合唯一键**，
 *   不存在单独的 code 唯一键，upsert 的 where 条件写不出来。
 *
 * ★ 更本质的原因（这条才是关键）
 *   软删除方案里 deletedAt 对"活着的"记录是 NULL，
 *   而 MySQL 的联合唯一索引中多个 NULL 互不冲突 ——
 *   也就是说**数据库层面根本挡不住两条 code 相同的存活记录**。
 *   这正是设计文档里强调"业务层必须显式查重"的原因。
 *   这里的 findFirst + deletedAt: null 就是那个"显式查重"。
 */
async function upsertRole(input: {
  code: string;
  name: string;
  description: string;
  sort: number;
}): Promise<bigint> {
  const existing = await prisma.sysRole.findFirst({
    where: { code: input.code, deletedAt: null },
    select: { id: true },
  });

  const data = {
    name: input.name,
    description: input.description,
    sort: input.sort,
    isBuiltin: 1,
    status: 1,
  };

  if (existing) {
    await prisma.sysRole.update({ where: { id: existing.id }, data });
    console.log(`  · 角色已存在，已更新：${input.code}`);
    return existing.id;
  }

  const created = await prisma.sysRole.create({
    data: { code: input.code, ...data },
    select: { id: true },
  });
  console.log(`  · 角色已创建：${input.code}`);
  return created.id;
}

/** 同上：先按 username 查重，再决定更新还是创建 */
async function upsertAdmin(): Promise<bigint> {
  // ★ 每次执行都重新生成哈希：盐是随机的，所以两次生成的哈希必然不同。
  //   这意味着反复跑 seed 会把已改过的密码**重置回默认值** ——
  //   本地开发无所谓，生产环境不要跑这个脚本。
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);

  const existing = await prisma.sysAdmin.findFirst({
    where: { username: ADMIN_USERNAME, deletedAt: null },
    select: { id: true },
  });

  const data = {
    password: passwordHash,
    nickname: '超级管理员',
    email: 'admin@mall-admin.dev',
    status: 1,
    isBuiltin: 1,
    remark: '内置超级管理员，禁止删除与禁用',
  };

  if (existing) {
    await prisma.sysAdmin.update({ where: { id: existing.id }, data });
    console.log(`  · 管理员已存在，密码已重置：${ADMIN_USERNAME}`);
    return existing.id;
  }

  const created = await prisma.sysAdmin.create({
    data: { username: ADMIN_USERNAME, ...data },
    select: { id: true },
  });
  console.log(`  · 管理员已创建：${ADMIN_USERNAME}`);
  return created.id;
}

/** 绑定管理员与角色。中间表没有软删除，用联合唯一键做存在性判断即可 */
async function linkAdminRole(adminId: bigint, roleId: bigint): Promise<void> {
  const existing = await prisma.sysAdminRole.findFirst({
    where: { adminId, roleId },
    select: { id: true },
  });

  if (existing) {
    console.log('  · 管理员与角色的关联已存在，跳过');
    return;
  }

  await prisma.sysAdminRole.create({ data: { adminId, roleId } });
  console.log('  · 已绑定超级管理员角色');
}

async function main(): Promise<void> {
  console.log('');
  console.log('=== 开始灌入种子数据 ===');

  const target = `${process.env.DATABASE_HOST ?? '127.0.0.1'}:${process.env.DATABASE_PORT ?? 3306}/${process.env.DATABASE_NAME ?? 'mall_admin'}`;
  console.log(`  目标数据库：${target}`);
  console.log('');

  console.log('[1/3] 角色');
  const roleIds = new Map<string, bigint>();
  for (const role of ROLES) {
    roleIds.set(role.code, await upsertRole(role));
  }

  console.log('');
  console.log('[2/3] 管理员');
  const adminId = await upsertAdmin();

  console.log('');
  console.log('[3/3] 管理员 - 角色关联');
  const superAdminRoleId = roleIds.get('SUPER_ADMIN');
  if (superAdminRoleId === undefined) {
    throw new Error('没有拿到 SUPER_ADMIN 角色 id，角色创建步骤有问题');
  }
  await linkAdminRole(adminId, superAdminRoleId);

  console.log('');
  console.log('=== 种子数据完成 ===');
  console.log('');
  console.log('  登录账号：' + ADMIN_USERNAME);
  console.log('  登录口令：' + ADMIN_PASSWORD);
  console.log('  ⚠️  这是本地开发用的默认口令，首次登录后请立即修改');
  console.log('');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    // 显式 exit：Prisma 的连接池和 adapter 有时会让进程多停留一会儿
    process.exit(0);
  })
  .catch(async (e: unknown) => {
    console.error('');
    console.error('=== 种子数据失败 ===');
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
