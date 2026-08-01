import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface MockUser {
  id: string
  name: string
  roles: string[]
}

interface AuthState {
  token: string | null
  user: MockUser | null
  loading: boolean
  /** mock 登录：不接 server，先验证父应用鉴权壳 */
  login: () => Promise<void>
  logout: () => void
}

const mockUser: MockUser = {
  id: 'u001',
  name: '王德师',
  roles: ['admin', 'hrbp', 'manager', 'employee'],
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      loading: false,
      login: async () => {
        set({ loading: true })
        await new Promise((resolve) => setTimeout(resolve, 300))
        set({ token: 'mock-token', user: mockUser, loading: false })
      },
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'micro-host-auth' },
  ),
)
