import { useQuery } from '@tanstack/react-query'
import { Button, Card, Flex, Spin, Statistic, Typography } from 'antd'
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
    <Flex vertical gap={24}>
      <div>
        <Typography.Title level={3}>全栈脚手架</Typography.Title>
        <Typography.Paragraph type="secondary">
        React + TypeScript + Tailwind CSS + React Router + Zustand + NestJS
        </Typography.Paragraph>
      </div>

      {/* API 联调示例 */}
      <Card title="后端 API 状态" extra={isPending ? <Spin size="small" /> : undefined}>
        <Statistic value={data?.status ?? '—'} valueStyle={{ color: '#52c41a' }} />
      </Card>

      {/* Zustand 计数器示例 */}
      <Card title="Zustand 状态管理示例">
        <Statistic value={count} />
        <Flex gap={8} style={{ marginTop: 16 }}>
          <Button onClick={decrement}>-1</Button>
          <Button type="primary" onClick={increment}>
            +1
          </Button>
          <Button onClick={reset}>重置</Button>
        </Flex>
      </Card>
    </Flex>
  )
}
