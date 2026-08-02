// 直接复用 packages/auth 的源码（同一仓库，免去 link 步骤），
// 打包发布后子应用可通过 npm 包 `@king-dede/auth` 引入同一套逻辑。
import { createAuth } from '../../packages/auth/src/index'
import type { AuthAdapter } from '../../packages/auth/src/index'

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
} from '../../packages/auth/src/index'
