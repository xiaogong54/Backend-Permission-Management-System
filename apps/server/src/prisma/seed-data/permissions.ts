/**
 * 权限树种子数据
 *
 * ============================================================================
 *  权限码规范：模块:资源:动作
 * ============================================================================
 *  例如 product:spu:create、order:order:export、system:admin:reset-pwd
 *
 *  这个 code 是**按钮权限与接口权限共用的同一个值**：
 *    · 前端：v-permission="'product:spu:create'" 控制按钮显隐
 *    · 后端：@RequirePermission('product:spu:create') 拦截接口
 *  共用同一个值意味着前后端不会对不上号 ——
 *  这是三级权限设计里最省事的一个决定。
 *
 * ============================================================================
 *  四种节点类型
 * ============================================================================
 *  type 1 目录：纯容器，**没有 code**（不对应任何权限，只用于菜单分组）
 *  type 2 菜单：有 code，对应一个页面路由
 *  type 3 按钮：有 code，页面内的操作按钮
 *  type 4 接口：有 code，无前端界面的接口（如文件上传）
 *
 *  ★ 目录为什么不给 code
 *    如果不给，它就不会出现在 sys_role_permission 里，也就永远不会被
 *    "误授予"。前端的菜单树则是：拿到已授权的菜单，再往上补齐父目录。
 *    给容器节点发权限是很多 RBAC 实现里"权限越授越多"的源头。
 *
 * ============================================================================
 *  ★ 为什么用固定 id 而不是自增
 * ============================================================================
 *  固定 id 让 parentId 的指向是显式、可读的（110 的父级就是 100），
 *  也让 seed 脚本可以幂等地 upsert —— 自增 id 每次跑都可能不一样，
 *  没法写 where 条件。
 *  代价是这批 id 成了事实上的约定值，后续新增权限点要用新的号段。
 */

/** 权限节点类型 */
export type PermissionType = 1 | 2 | 3 | 4;

export interface PermissionSeed {
  id: number;
  parentId: number;
  name: string;
  type: PermissionType;
  code: string | null;
  routePath: string | null;
  routeName: string | null;
  component: string | null;
  icon: string | null;
  sort: number;
  visible: number;
  keepAlive: number;
  httpMethod: string | null;
  apiPath: string | null;
}

/** 构造一个完整的节点，把没填的字段补成 null / 默认值 */
function node(
  partial: Pick<PermissionSeed, 'id' | 'parentId' | 'name' | 'type' | 'sort'> &
    Partial<PermissionSeed>,
): PermissionSeed {
  return {
    code: null,
    routePath: null,
    routeName: null,
    component: null,
    icon: null,
    visible: 1,
    keepAlive: 0,
    httpMethod: null,
    apiPath: null,
    ...partial,
  };
}

/** 目录：纯菜单分组，没有 code */
const dir = (
  id: number,
  name: string,
  icon: string,
  sort: number,
): PermissionSeed => node({ id, parentId: 0, name, type: 1, icon, sort });

/** 菜单：有路由，有 code */
const menu = (
  id: number,
  parentId: number,
  name: string,
  code: string,
  routePath: string,
  component: string,
  icon: string,
  sort: number,
): PermissionSeed =>
  node({
    id,
    parentId,
    name,
    type: 2,
    code,
    routePath,
    // routeName 用大驼峰，供前端 keep-alive 按组件名缓存
    routeName: routePath
      .split('/')
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(''),
    component,
    icon,
    sort,
  });

/** 按钮：页面内的操作权限 */
const btn = (
  id: number,
  parentId: number,
  name: string,
  code: string,
  sort: number,
): PermissionSeed => node({ id, parentId, name, type: 3, code, sort });

/** 接口：没有前端界面的接口权限 */
const api = (
  id: number,
  parentId: number,
  name: string,
  code: string,
  httpMethod: string,
  apiPath: string,
  sort: number,
): PermissionSeed =>
  node({ id, parentId, name, type: 4, code, httpMethod, apiPath, sort });

export const PERMISSIONS: PermissionSeed[] = [
  // ==========================================================================
  //  系统管理
  // ==========================================================================
  dir(100, '系统管理', 'Setting', 1),

  menu(
    110,
    100,
    '管理员管理',
    'system:admin:list',
    '/system/admin',
    'system/admin/index',
    'User',
    1,
  ),
  btn(111, 110, '新增管理员', 'system:admin:create', 1),
  btn(112, 110, '编辑管理员', 'system:admin:update', 2),
  btn(113, 110, '删除管理员', 'system:admin:delete', 3),
  btn(114, 110, '分配角色', 'system:admin:assign-role', 4),
  btn(115, 110, '重置密码', 'system:admin:reset-pwd', 5),
  btn(116, 110, '启用 / 禁用', 'system:admin:status', 6),

  menu(
    120,
    100,
    '角色管理',
    'system:role:list',
    '/system/role',
    'system/role/index',
    'Avatar',
    2,
  ),
  btn(121, 120, '新增角色', 'system:role:create', 1),
  btn(122, 120, '编辑角色', 'system:role:update', 2),
  btn(123, 120, '删除角色', 'system:role:delete', 3),
  btn(124, 120, '分配权限', 'system:role:assign-perm', 4),

  menu(
    130,
    100,
    '权限管理',
    'system:permission:list',
    '/system/permission',
    'system/permission/index',
    'Lock',
    3,
  ),
  btn(131, 130, '新增权限', 'system:permission:create', 1),
  btn(132, 130, '编辑权限', 'system:permission:update', 2),
  btn(133, 130, '删除权限', 'system:permission:delete', 3),

  menu(
    140,
    100,
    '操作日志',
    'system:log:list',
    '/system/log',
    'system/log/index',
    'Document',
    4,
  ),
  btn(141, 140, '日志详情', 'system:log:detail', 1),
  btn(142, 140, '导出日志', 'system:log:export', 2),
  btn(143, 140, '清空日志', 'system:log:clear', 3),

  // ==========================================================================
  //  商品管理
  // ==========================================================================
  dir(200, '商品管理', 'Goods', 2),

  menu(
    210,
    200,
    '商品分类',
    'product:category:list',
    '/product/category',
    'product/category/index',
    'Files',
    1,
  ),
  btn(211, 210, '新增分类', 'product:category:create', 1),
  btn(212, 210, '编辑分类', 'product:category:update', 2),
  btn(213, 210, '删除分类', 'product:category:delete', 3),

  menu(
    220,
    200,
    '规格管理',
    'product:spec:list',
    '/product/spec',
    'product/spec/index',
    'Grid',
    2,
  ),
  btn(221, 220, '新增规格', 'product:spec:create', 1),
  btn(222, 220, '编辑规格', 'product:spec:update', 2),
  btn(223, 220, '删除规格', 'product:spec:delete', 3),

  menu(
    230,
    200,
    '商品列表',
    'product:spu:list',
    '/product/spu',
    'product/spu/index',
    'ShoppingBag',
    3,
  ),
  btn(231, 230, '新增商品', 'product:spu:create', 1),
  btn(232, 230, '编辑商品', 'product:spu:update', 2),
  btn(233, 230, '删除商品', 'product:spu:delete', 3),
  btn(234, 230, '批量上下架', 'product:spu:batch-status', 4),
  btn(235, 230, '调整库存', 'product:spu:stock', 5),
  btn(236, 230, '导出商品', 'product:spu:export', 6),
  btn(237, 230, '商品详情', 'product:spu:detail', 7),

  // ==========================================================================
  //  订单管理
  // ==========================================================================
  dir(300, '订单管理', 'List', 3),

  menu(
    310,
    300,
    '订单列表',
    'order:order:list',
    '/order/list',
    'order/list/index',
    'Tickets',
    1,
  ),
  btn(311, 310, '订单详情', 'order:order:detail', 1),
  btn(312, 310, '订单发货', 'order:order:deliver', 2),
  btn(313, 310, '关闭订单', 'order:order:close', 3),
  btn(314, 310, '订单备注', 'order:order:remark', 4),
  btn(315, 310, '导出订单', 'order:order:export', 5),
  btn(316, 310, '打印面单', 'order:order:print', 6),

  // ==========================================================================
  //  用户管理
  // ==========================================================================
  dir(400, '用户管理', 'UserFilled', 4),

  menu(
    410,
    400,
    '用户列表',
    'user:user:list',
    '/user/list',
    'user/list/index',
    'Postcard',
    1,
  ),
  btn(411, 410, '用户详情', 'user:user:detail', 1),
  btn(412, 410, '启用 / 禁用', 'user:user:status', 2),
  btn(413, 410, '导出用户', 'user:user:export', 3),
  btn(414, 410, '收货地址', 'user:user:address', 4),
  btn(415, 410, '调整等级', 'user:user:level', 5),

  // ==========================================================================
  //  数据看板（一级菜单，没有父目录）
  // ==========================================================================
  menu(
    500,
    0,
    '数据看板',
    'dashboard:index:view',
    '/dashboard',
    'dashboard/index',
    'DataLine',
    5,
  ),

  // ==========================================================================
  //  无界面接口权限
  // ==========================================================================
  api(
    900,
    0,
    '文件上传',
    'file:file:upload',
    'POST',
    '/api/v1/files/upload',
    1,
  ),
  api(901, 0, '文件删除', 'file:file:delete', 'DELETE', '/api/v1/files/:id', 2),
];

// ============================================================================
//  角色授权
// ============================================================================
//  ★ 超级管理员（SUPER_ADMIN）刻意不出现在这里
//    它走的是通配符 '*'，一行授权都不需要落库。
//    好处是后续新增权限点无需回头给它补授权 ——
//    这规避了 RBAC 最经典的事故："加了新功能，超管反而没权限"。

/**
 * 运营管理员：负责商品维护、订单处理与用户日常管理
 * 不给系统配置类权限（账号、角色、权限、日志）
 */
const OPERATOR_CODES: string[] = [
  // 数据看板：所有角色都要能进首页。
  // 漏了它的话，运营登录后会被默认跳转到 /dashboard，然后立刻吃一个 403。
  'dashboard:index:view',
  // 商品：可增删改查、上下架、调库存、导出
  'product:category:list',
  'product:category:create',
  'product:category:update',
  'product:category:delete',
  'product:spec:list',
  'product:spec:create',
  'product:spec:update',
  'product:spec:delete',
  'product:spu:list',
  'product:spu:create',
  'product:spu:update',
  'product:spu:delete',
  'product:spu:batch-status',
  'product:spu:stock',
  'product:spu:export',
  'product:spu:detail',
  // 订单：全流程处理
  'order:order:list',
  'order:order:detail',
  'order:order:deliver',
  'order:order:close',
  'order:order:remark',
  'order:order:export',
  'order:order:print',
  // 用户：可查看与启禁用，但不给导出和调等级
  'user:user:list',
  'user:user:detail',
  'user:user:status',
  'user:user:address',
  // 文件
  'file:file:upload',
];

/**
 * 数据管理员：只读 + 导出，不含任何写权限
 *
 * 这个角色存在的意义就是验证"只读角色"能不能被权限系统正确表达：
 * 它能看见列表、进详情、导报表，但所有写接口都应该返回 403。
 */
const DATA_ADMIN_CODES: string[] = [
  'dashboard:index:view',
  // 系统：只能看日志，且不能清空
  'system:log:list',
  'system:log:detail',
  'system:log:export',
  // 商品：只读 + 导出
  'product:category:list',
  'product:spec:list',
  'product:spu:list',
  'product:spu:detail',
  'product:spu:export',
  // 订单：只读 + 导出
  'order:order:list',
  'order:order:detail',
  'order:order:export',
  // 用户：只读 + 导出
  'user:user:list',
  'user:user:detail',
  'user:user:export',
];

/** 角色码 → 该角色应授予的权限码列表 */
export const ROLE_GRANTS: Record<string, string[]> = {
  OPERATOR: OPERATOR_CODES,
  DATA_ADMIN: DATA_ADMIN_CODES,
};
