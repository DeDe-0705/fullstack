import {
  Suspense,
  use,
  useActionState,
  useOptimistic,
  useState,
  useTransition,
} from 'react'
import { Alert, Button, Card, Flex, Input, Space, Tag, Typography } from 'antd'

/**
 * 主题五：React 19 新特性（Actions / use / useOptimistic / useTransition）
 *
 * 面试高频（2025-2026 大厂必问）：
 * 1. React 19 有哪些重要新特性？
 * 2. use() 和 useEffect 有什么区别？
 * 3. useOptimistic 的原理？什么场景用？
 * 4. Actions 是什么？和普通事件处理有什么区别？
 * 5. useTransition 和 useDeferredValue 的区别？
 *
 * 核心原理：
 * - Actions：表单/异步操作的一等公民，自动处理 pending 状态
 * - use()：在 render 中直接读取 Promise/Context，配合 Suspense
 * - useOptimistic：乐观更新——先更新 UI，失败后回滚
 * - useTransition：标记低优先级更新，保持 UI 响应
 */

// ========== 演示 1：useTransition —— 低优先级更新 ==========
function TransitionDemo() {
  const [isPending, startTransition] = useTransition()
  const [urgent, setUrgent] = useState('')
  const [slowList, setSlowList] = useState<string[]>([])

  const handleInput = (value: string) => {
    // 紧急更新：输入框立即响应
    setUrgent(value)
    // 非紧急更新：大列表渲染被标记为低优先级，可以被打断
    startTransition(() => {
      setSlowList(
        Array.from({ length: 10000 }, (_, i) => `${value}-item-${i}`),
      )
    })
  }

  return (
    <Flex vertical gap={8}>
      <Input
        value={urgent}
        onChange={e => handleInput(e.target.value)}
        placeholder="快速输入，输入框不卡顿"
        style={{ maxWidth: 400 }}
      />
      <Space>
        <Typography.Text type="secondary">
          输入框（紧急更新）：{urgent || '—'}
        </Typography.Text>
        {isPending && <Tag color="processing">后台渲染 10000 条中...</Tag>}
      </Space>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        列表已渲染 {slowList.length} 条（低优先级，可被打断）
      </Typography.Text>
    </Flex>
  )
}

// ========== 演示 2：useOptimistic —— 乐观更新 ==========
function OptimisticDemo() {
  const [messages, setMessages] = useState([
    { id: 1, text: '欢迎来到乐观更新演示', sending: false },
  ])
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    // reducer：乐观状态下立即把新消息加进去
    (state, newText: string) => [
      ...state,
      { id: Date.now(), text: newText, sending: true },
    ],
  )

  const [input, setInput] = useState('')

  const sendMessage = async (formData: FormData) => {
    const text = formData.get('message') as string
    if (!text.trim()) return

    // 立即乐观更新 UI（不等服务器响应）
    addOptimisticMessage(text)
    setInput('')

    // 模拟 API 延迟 2 秒
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 服务器确认后更新真实状态
    setMessages(prev => [
      ...prev,
      { id: Date.now(), text, sending: false },
    ])
  }

  return (
    <Flex vertical gap={8}>
      <form action={sendMessage}>
        <Space.Compact style={{ width: '100%', maxWidth: 500 }}>
          <Input
            name="message"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="输入消息，立即显示（乐观更新）"
          />
          <Button type="primary" htmlType="submit">
            发送
          </Button>
        </Space.Compact>
      </form>
      <Flex vertical gap={4}>
        {optimisticMessages.map(msg => (
          <Typography.Text key={msg.id} style={{ fontSize: 13 }}>
            {msg.text}
            {msg.sending && <Tag color="gold" style={{ marginLeft: 8 }}>发送中...</Tag>}
          </Typography.Text>
        ))}
      </Flex>
    </Flex>
  )
}

// ========== 演示 3：use() —— 在 render 中读取 Promise ==========
function UseDemo() {
  // use() 可以读取 Promise，配合 Suspense 实现数据预取
  // 注意：use() 不能在 try/catch 中使用，需要 Suspense 边界
  const promise = useMemoPromise()
  const data = use(promise)

  return (
    <Typography.Text>
      use() 读取 Promise 结果：{data}
    </Typography.Text>
  )
}

// 辅助函数：创建一个缓存的 Promise（避免每次渲染创建新 Promise 导致无限循环）
let cachedPromise: Promise<string> | null = null
function useMemoPromise(): Promise<string> {
  if (!cachedPromise) {
    cachedPromise = new Promise(resolve => {
      setTimeout(() => resolve('异步数据加载完成（配合 Suspense 展示 fallback）'), 1500)
    })
  }
  return cachedPromise
}

// ========== 演示 4：useActionState —— 表单 Actions ==========
function ActionStateDemo() {
  const [state, formAction, isPending] = useActionState(
    async (_prevState: { message: string; error?: string }, formData: FormData) => {
      const name = formData.get('name') as string
      if (!name) {
        return { message: '', error: '名字不能为空' }
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
      return { message: `提交成功：${name}` }
    },
    { message: '' },
  )

  return (
    <Flex vertical gap={8}>
      <form action={formAction}>
        <Space.Compact style={{ width: '100%', maxWidth: 500 }}>
          <Input name="name" placeholder="输入名字" />
          <Button type="primary" htmlType="submit" loading={isPending}>
            提交
          </Button>
        </Space.Compact>
      </form>
      {state.message && <Tag color="green">{state.message}</Tag>}
      {state.error && <Tag color="red">{state.error}</Tag>}
    </Flex>
  )
}

export function React19Features() {
  return (
    <Flex vertical gap={24}>
      <div>
        <Typography.Title level={3}>React 19 新特性</Typography.Title>
        <Alert
          type="info"
          showIcon
          message="React 19（2024.12 发布）引入了 Actions、use()、useOptimistic 等新能力，是大厂 2025-2026 面试必问。"
          description="重点理解：Actions 让表单/异步操作有了一等公民支持；use() 在 render 中直接读取 Promise；useOptimistic 简化乐观更新；React Compiler 自动化 memoization。"
        />
      </div>

      <Card title="useTransition —— 区分紧急/非紧急更新" size="small">
        <TransitionDemo />
      </Card>

      <Card title="useOptimistic —— 乐观更新" size="small">
        <OptimisticDemo />
      </Card>

      <Card title="use() —— render 中读取 Promise" size="small">
        <Suspense fallback={<Typography.Text type="secondary">加载中...</Typography.Text>}>
          <UseDemo />
        </Suspense>
      </Card>

      <Card title="useActionState —— 表单 Actions" size="small">
        <ActionStateDemo />
      </Card>
    </Flex>
  )
}

