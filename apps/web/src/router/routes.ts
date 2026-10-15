import type { RouteRecordRaw } from 'vue-router';

/**
 * 扩展路由 meta 的类型
 * 不声明的话，to.meta.title 会是 unknown，模板里用起来很难受
 */
declare module 'vue-router' {
  interface RouteMeta {
    /** 页面标题，用于浏览器标题栏与面包屑 */
    title?: string;
    /** Element Plus 图标组件名 */
    icon?: string;
    /** 是否免登录。默认要求登录（默认拒绝比默认放行安全） */
    public?: boolean;
    /** 是否被 keep-alive 缓存 */
    keepAlive?: boolean;
    /** 菜单里是否隐藏 */
    hidden?: boolean;
    /**
     * 页面级权限码
     *
     * ★ 与后端 @RequirePermission 用**同一个 code**
     *   这样"菜单里能看到"和"接口能调通"永远一致，
     *   不会出现"页面进得去但所有请求都 403"这种别扭状态。
     *   不写 = 只要求登录（例如数据看板对所有角色开放时）。
     */
    permission?: string;
    /** 侧边栏分组 key，见下面的 MENU_GROUPS */
    group?: string;
    /** 组内排序 */
    order?: number;
  }
}

/** 侧边栏分组 */
export interface MenuGroup {
  key: string;
  title: string;
  icon: string;
  order: number;
}

/**
 * 侧边栏分组定义
 *
 * ★ 为什么分组单独定义，而不是把菜单结构整个写死在布局组件里
 *   路由表已经是"系统里有哪些页面"的唯一事实来源。
 *   如果布局里再手抄一份菜单结构，就会出现"加了路由忘了加菜单"
 *   或者"菜单指向的路由已被改名"这类问题，而且不会有任何报错。
 *   这里只补充路由表表达不了的**分组与排序**信息。
 */
export const MENU_GROUPS: MenuGroup[] = [
  { key: 'dashboard', title: '数据看板', icon: 'DataLine', order: 1 },
  { key: 'product', title: '商品管理', icon: 'Goods', order: 2 },
  { key: 'order', title: '订单管理', icon: 'List', order: 3 },
  { key: 'user', title: '用户管理', icon: 'UserFilled', order: 4 },
  { key: 'system', title: '系统管理', icon: 'Setting', order: 5 },
];

const Layout = () => import('@/layout/index.vue');

/**
 * 业务页面统一指向占位组件
 *
 * 这些模块的页面还没做。指向一个统一的"建设中"页面，而不是让菜单项
 * 处于 disabled 状态，有两个好处：
 *   1. 菜单可点，能直观看到"不同角色看到的菜单不一样"
 *   2. 路由真实存在，页面级权限（to.meta.permission）可以真的被触发和验证
 *
 * 模块做出来之后，把 component 换成真实页面即可，路由与权限配置不用动。
 */
const Placeholder = () => import('@/views/placeholder/index.vue');

/** 业务路由：权限码与后端权限树里的菜单节点完全一致 */
const businessRoutes: RouteRecordRaw[] = [
  {
    path: 'product/category',
    name: 'ProductCategory',
    component: Placeholder,
    meta: {
      title: '商品分类',
      icon: 'Files',
      group: 'product',
      order: 1,
      permission: 'product:category:list',
    },
  },
  {
    path: 'product/spec',
    name: 'ProductSpec',
    component: Placeholder,
    meta: {
      title: '规格管理',
      icon: 'Grid',
      group: 'product',
      order: 2,
      permission: 'product:spec:list',
    },
  },
  {
    path: 'product/spu',
    name: 'ProductSpu',
    component: Placeholder,
    meta: {
      title: '商品列表',
      icon: 'ShoppingBag',
      group: 'product',
      order: 3,
      permission: 'product:spu:list',
    },
  },
  {
    path: 'order/list',
    name: 'OrderList',
    component: Placeholder,
    meta: {
      title: '订单列表',
      icon: 'Tickets',
      group: 'order',
      order: 1,
      permission: 'order:order:list',
    },
  },
  {
    path: 'user/list',
    name: 'UserList',
    component: Placeholder,
    meta: {
      title: '用户列表',
      icon: 'Postcard',
      group: 'user',
      order: 1,
      permission: 'user:user:list',
    },
  },
  {
    path: 'system/admin',
    name: 'SystemAdmin',
    component: Placeholder,
    meta: {
      title: '管理员管理',
      icon: 'User',
      group: 'system',
      order: 1,
      permission: 'system:admin:list',
    },
  },
  {
    path: 'system/role',
    name: 'SystemRole',
    component: Placeholder,
    meta: {
      title: '角色管理',
      icon: 'Avatar',
      group: 'system',
      order: 2,
      permission: 'system:role:list',
    },
  },
  {
    path: 'system/permission',
    name: 'SystemPermission',
    component: Placeholder,
    meta: {
      title: '权限管理',
      icon: 'Lock',
      group: 'system',
      order: 3,
      permission: 'system:permission:list',
    },
  },
  {
    path: 'system/log',
    name: 'SystemLog',
    component: Placeholder,
    meta: {
      title: '操作日志',
      icon: 'Document',
      group: 'system',
      order: 4,
      permission: 'system:log:list',
    },
  },
];

/**
 * 静态路由
 *
 * 等后端的 GET /auth/menus 做完后，业务页面改为登录后由后端下发菜单树动态注册，
 * 这里只保留登录、403、404 这些与权限无关的页面。
 */
export const constantRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', public: true, hidden: true },
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/error/403.vue'),
    // public: 无权限页面本身不能再要求权限，否则会无限重定向
    meta: { title: '无访问权限', public: true, hidden: true },
  },
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: {
          title: '数据看板',
          icon: 'DataLine',
          group: 'dashboard',
          order: 1,
          keepAlive: true,
          permission: 'dashboard:index:view',
        },
      },
      ...businessRoutes,
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面不存在', public: true, hidden: true },
  },
];

export default constantRoutes;
