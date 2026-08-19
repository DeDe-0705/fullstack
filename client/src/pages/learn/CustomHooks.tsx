import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Flex, Input, Space, Typography } from 'antd'

/**
 * 主题三：自定义 Hook 设计（对比 Vue composables）
 *
 * 面试高频：
 * 1. 自定义 Hook 的设计原则？和普通函数有什么区别？
 * 2. 和 Vue composables 的异同？
 * 3. 手写 useDebounce / useThrottle / usePrevious / useForm
 *
 * 核心原理：
 * 自定义 Hook 本质是「以 use 开头、内部调用其他 Hook 的函数」。
 * 它不是 UI 复用，而是「状态逻辑」复用——把组件里的有状态逻辑抽出来，
 * 让多个组件共享同一段逻辑（但每个组件实例拥有独立的 state）。
 */

// ========== 自定义 Hook 1：usePrevious —— 获取上一次渲染的值 ==========
function usePrevious<T>(value: T): T | undefined {
  const [current, setCurrent] = useState(value)
  const [previous, setPrevious] = useState<T | undefined>(undefined)

  // React 19 推荐实现：render 阶段直接比较，不用 ref
  // 这就是「adjusting state during render」模式——
  // 在 render 中 setState，React 会在当前渲染结束后立即再渲染一次
  if (value !== current) {
    setCurrent(value)
    setPrevious(current)
  }

  return previous
}

// ========== 自定义 Hook 2：useDebounce —— 防抖 ==========
function useDebounce<T>(value: T, delay = 500): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer) // 清理函数：value 变化时取消上一个定时器
  }, [value, delay])

  return debounced
}

// ========== 自定义 Hook 3：useThrottle —— 节流 ==========
function useThrottle<T>(value: T, interval = 500): T {
  const [throttled, setThrottled] = useState(value)
  // 惰性初始化：避免在 render 中调用 impure 函数 Date.now()
  const lastRun = useRef<number>(0)
  const pendingValue = useRef(value)

  useEffect(() => {
    // 首次执行时初始化 lastRun
    if (lastRun.current === 0) {
      lastRun.current = Date.now()
    }
    const now = Date.now()
    const remaining = interval - (now - lastRun.current)

    if (remaining <= 0) {
      // 距上次更新已超过 interval，立即更新
      lastRun.current = now
      setThrottled(value)
    } else {
      // 还没到时间，记录 pending 值，等时间到了再更新
      pendingValue.current = value
      const timer = setTimeout(() => {
        lastRun.current = Date.now()
        setThrottled(pendingValue.current)
      }, remaining)
      return () => clearTimeout(timer)
    }
  }, [value, interval])

  return throttled
}

// ========== 自定义 Hook 4：useLocalStorage —— 持久化状态 ==========
function useLocalStorage<T>(key: string, initialValue: T) {
  // 惰性初始化：只在首次渲染时读取 localStorage
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? (JSON.parse(stored) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue] as const
}

export function CustomHooks() {
  const [input, setInput] = useState('')
  const [count, setCount] = useState(0)
  const previousCount = usePrevious(count)
  const debouncedInput = useDebounce(input, 800)
  const throttledCount = useThrottle(count, 1000)
  const [savedName, setSavedName] = useLocalStorage('learn-user-name', '德德')

  return (
    <Flex vertical gap={24}>
      <div>
        <Typography.Title level={3}>自定义 Hook 设计</Typography.Title>
        <Alert
          type="info"
          showIcon
          message="自定义 Hook 复用的是「状态逻辑」，不是 UI。每个使用 Hook 的组件实例拥有独立的 state。"
          description="对比 Vue composables：概念相同，但 Vue 是 setup 里组合 ref/computed/watch，React 是函数组件里组合 useState/useEffect 等 Hook。"
        />
      </div>

      <Card title="usePrevious —— 获取上一次渲染的值" size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Paragraph type="secondary">
            面试高频：手写 usePrevious。关键点：先返回 ref.current（旧值），effect 执行后再更新 ref。
          </Typography.Paragraph>
          <Space>
            <Button onClick={() => setCount(c => c + 1)}>count +1</Button>
            <Typography.Text>
              当前：{count}，上一次：{previousCount ?? '—'}
            </Typography.Text>
          </Space>
        </Space>
      </Card>

      <Card title="useDebounce —— 防抖" size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Paragraph type="secondary">
            输入停止 800ms 后才更新 debounced 值。清理函数确保每次输入都重置计时器。
          </Typography.Paragraph>
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="输入文字，观察防抖"
            style={{ maxWidth: 400 }}
          />
          <Typography.Text type="secondary">
            原始值：{input || '—'} → 防抖后：{debouncedInput || '—'}
          </Typography.Text>
        </Space>
      </Card>

      <Card title="useThrottle —— 节流" size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Paragraph type="secondary">
            快速点击 count +1，节流值最多 1 秒更新一次。
          </Typography.Paragraph>
          <Space>
            <Button onClick={() => setCount(c => c + 1)}>快速点击 +1</Button>
            <Typography.Text>
              count：{count}，节流后：{throttledCount}
            </Typography.Text>
          </Space>
        </Space>
      </Card>

      <Card title="useLocalStorage —— 持久化状态" size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Paragraph type="secondary">
            修改后刷新页面，值会保留（存在 localStorage）。这是 Zustand persist 的底层原理。
          </Typography.Paragraph>
          <Input
            value={savedName}
            onChange={e => setSavedName(e.target.value)}
            placeholder="输入名字，刷新页面验证持久化"
            style={{ maxWidth: 400 }}
          />
        </Space>
      </Card>
    </Flex>
  )
}
