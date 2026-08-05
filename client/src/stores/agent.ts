import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 当前登录用户属于"会话级 UI 状态"，持久化到 localStorage，
// 刷新页面后仍保持登录态；会话/消息数据仍由 TanStack Query 管理
interface AgentUiState {
  userId: string | undefined
  userName: string | undefined
  setSession: (userId: string, userName: string) => void
  clearSession: () => void
}

export const useAgentStore = create<AgentUiState>()(
  persist(
    (set) => ({
      userId: undefined,
      userName: undefined,
      setSession: (userId, userName) => set({ userId, userName }),
      clearSession: () => set({ userId: undefined, userName: undefined }),
    }),
    { name: 'agent-session' },
  ),
)
