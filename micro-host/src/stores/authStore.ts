import { create } from 'zustand'
import { auth } from '../auth'
import type { AuthUser } from '../auth'

interface AuthState {
  /** accessToken（wujie props 透传给子应用用；子应用也可直接引 @king-dede/auth） */
  token: string | null
  user: AuthUser | null
  loading: boolean
  login: () => Promise<void>
  logout: () => void
}

/**
 * 登录态读写统一交给 @king-dede/auth（见 src/auth），
 * store 只做 React 侧的状态镜像：subscribe 同步 token/user，
 * 事件广播（login/logout/token-refreshed/...）由包内 bus 统一负责。
 */
export const useAuthStore = create<AuthState>()((set) => {
  auth.subscribe(({ token, user }) => set({ token: token?.accessToken ?? null, user }))

  return {
    token: auth.getAccessToken(),
    user: auth.getUser(),
    loading: false,
    login: async () => {
      set({ loading: true })
      try {
        await auth.login({ username: 'mock', password: 'mock' })
        await auth.getPermissions()
      } finally {
        set({ loading: false })
      }
    },
    logout: () => auth.logout(),
  }
})
