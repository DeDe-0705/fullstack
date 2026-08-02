// 通过 vite/tsconfig 别名 @king-dede/auth 直接引用本地包源码（免去 link），
// 与子应用发布后从 npm 引入的写法完全一致。
import { createAuth } from '@king-dede/auth'
import type { AuthAdapter } from '@king-dede/auth'

const mockUser = {
  id: 'u001',
  name: '王德师',
  roles: ['admin', 'hrbp', 'manager', 'employee'],
}

/** mock 适配器：不接 server，先验证父应用鉴权壳；接 server 后换成真实 HTTP 实现 */
const mockAdapter: AuthAdapter = {
  login: async () => {
    await new Promise((resolve) => setTimeout(resolve, 300))
    return {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 7200,
      user: mockUser,
    }
  },
  refresh: async (refreshToken) => ({
    accessToken: 'mock-access-token-refreshed',
    refreshToken,
    expiresIn: 7200,
  }),
  getUserInfo: async () => mockUser,
  getPermissions: async () => ['micro:ui-kit:view', 'micro:*:manage'],
}

export const auth = createAuth({
  appId: 'micro-host',
  adapter: mockAdapter,
  // 鉴权过期（refresh 失败）后的兜底：跳转登录页
  onUnauthorized: () => {
    window.location.href = '/login'
  },
})

export {
  Auth,
  createAuth,
  type AuthAdapter,
  type AuthUser,
  type AuthState,
  type AuthEvent,
  type AuthEventType,
  type AuthListener,
  type BusListener,
  type AuthOptions,
  type LoginResult,
  type TokenBundle,
} from '@king-dede/auth'
