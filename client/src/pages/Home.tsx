import { useQuery } from '@tanstack/react-query'
import { useCounterStore } from '../stores/counter'
import { api } from '../lib/api'

export function Home() {
  const { count, increment, decrement, reset } = useCounterStore()
  // 服务端状态交给 TanStack Query，替代原来的 useEffect + useState 手写取数
  const { data, isPending } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<{ status: string }>('/health'),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">全栈脚手架</h1>
      <p className="text-gray-600">
        React + TypeScript + Tailwind CSS + React Router + Zustand + NestJS
      </p>

      {/* API 联调示例 */}
      <div className="p-4 bg-white rounded-lg border border-gray-200">
        <p className="text-sm text-gray-500">后端 API 状态</p>
        <p className="text-lg font-semibold text-green-600">
          {isPending ? '加载中...' : data?.status}
        </p>
      </div>

      {/* Zustand 计数器示例 */}
      <div className="p-4 bg-white rounded-lg border border-gray-200 space-y-3">
        <p className="text-sm text-gray-500">Zustand 状态管理示例</p>
        <p className="text-2xl font-bold tabular-nums">{count}</p>
        <div className="flex gap-2">
          <button
            onClick={decrement}
            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            -1
          </button>
          <button
            onClick={increment}
            className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            +1
          </button>
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            重置
          </button>
        </div>
      </div>
    </div>
  )
}
