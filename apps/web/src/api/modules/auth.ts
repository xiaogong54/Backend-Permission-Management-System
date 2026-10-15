import { request } from '../request';

/**
 * 认证接口
 *
 * 字段与 apps/server 的 AuthService 返回结构严格对应。
 *
 * ⚠️ 注意：前端的类型定义只是"接口契约"的客户端副本。
 *    后端改了返回结构而这里没改，TS 编译**不会**报错（跨进程，类型对不上号）。
 *    所以真实联调是唯一的验证手段，别只信类型。
 */

/** 图形验证码 */
export interface CaptchaVo {
  /** 登录时要一起提交回去的标识 */
  captchaId: string;
  /** SVG 图片内容，用 v-html 渲染 */
  svg: string;
  /** 有效期（秒） */
  expiresIn: number;
}

/** 登录请求参数 */
export interface LoginParams {
  username: string;
  password: string;
  captchaId: string;
  captcha: string;
}

/** 后端返回的用户信息 */
export interface UserInfo {
  id: number;
  username: string;
  nickname: string;
  avatar: string | null;
}

/** 登录成功的返回 */
export interface LoginResult {
  token: string;
  userInfo: UserInfo;
  roles: string[];
  permissions: string[];
}

/** 当前登录人信息 */
export interface ProfileResult {
  userInfo: UserInfo & {
    email: string | null;
    phone: string | null;
  };
  roles: string[];
  permissions: string[];
  lastLoginAt: string | null;
}

/** 获取图形验证码 */
export function getCaptcha(): Promise<CaptchaVo> {
  return request.get<CaptchaVo>('/auth/captcha');
}

/** 账号密码登录 */
export function login(data: LoginParams): Promise<LoginResult> {
  return request.post<LoginResult>('/auth/login', data);
}

/** 查询当前登录人（含角色与权限码） */
export function getProfile(): Promise<ProfileResult> {
  return request.get<ProfileResult>('/auth/profile');
}

/** 退出登录（后端会把该 token 加入黑名单） */
export function logout(): Promise<{ message: string }> {
  return request.post<{ message: string }>('/auth/logout');
}
