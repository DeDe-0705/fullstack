import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 30s 内数据视为"新鲜"：切页面再回来不会立刻重新请求
      // （面试高频：staleTime 决定缓存的新鲜期，默认 0 即每次挂载都重新拉取）
      staleTime: 30_000,
      retry: 1,
    },
  },
})
