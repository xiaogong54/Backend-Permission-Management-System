/**
 * Token 存取
 *
 * ★ 为什么单独抽成模块，而不是写在 api/request.ts 里
 *
 *   原先 getToken / setToken / clearToken 定义在 api/request.ts，
 *   而 request.ts 又需要读 store 里的用户状态，store 又要调 api 模块 ——
 *   于是形成 request → store → api/auth → request 的**三环循环依赖**。
 *
 *   虽然 ESM 能靠"只在函数体里引用"绕过（模块初始化时不取值就不报错），
 *   但这种能跑全靠时序巧合的代码，改动一次就可能炸，而且报错信息通常
 *   指向一个完全无关的地方。
 *
 *   把 localStorage 的读写抽成 **叶子模块**（不依赖任何其它业务模块）之后，
 *   request 与 store 都指向它，依赖图上少了一个环。
 *   token 的存储键也从此只有这一处定义，不会出现两边写不同 key 的问题。
 *
 * ★ 两处存储，对应「记住我」这个勾选框
 *   localStorage   —— 关掉浏览器再打开依然登录（记住我）
 *   sessionStorage —— 关掉标签页就失效（不记住）
 *   两者都读，优先 localStorage。
 */

const TOKEN_KEY = 'mall-admin-token';

export function getToken(): string {
  // 隐私模式 / 某些内嵌浏览器里访问 storage 会抛异常，兜一层避免整个应用白屏
  try {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * 写入 token
 *
 * ★ 必须**清掉另一处**，不能只写不删
 *   否则会出现这种情况：先勾"记住我"登录（写进 localStorage），
 *   退出，再取消勾选登录（写进 sessionStorage）——
 *   此时 localStorage 里那条旧 token 还在，getToken() 优先读它，
 *   结果是"明明没勾记住我，关掉浏览器却还是登录状态"。
 */
export function setToken(token: string, remember = true): void {
  try {
    if (remember) {
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // 存不进去只影响"刷新后免登录"，不该让登录本身失败
  }
}

export function clearToken(): void {
  try {
    // 两处都要清，理由同上
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // 忽略
  }
}
