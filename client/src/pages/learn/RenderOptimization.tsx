import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { Alert, Button, Card, Flex, Space, Statistic, Typography } from 'antd'

/**
 * 主题四：渲染优化（memo / useMemo / useCallback / React Compiler）
 *
 * 面试高频：
 * 1. React.memo 的原理？什么时候用？什么时候不用？
 * 2. useMemo 和 useCallback 的区别？底层原理？
 * 3. 为什么「有时候用了反而更慢」？
 * 4. React Compiler 如何自动化这些优化？
 *
 * 核心原理：
 * - React.memo：浅比较 props，相同则跳过重新渲染（类似 Vue 的 props 比较）
 * - useMemo：缓存「计算结果」，依赖不变则返回缓存值
 * - useCallback：缓存「函数引用」，依赖不变则返回同一函数
 * - React Compiler：编译期自动插入 memo/useMemo/useCallback
 */

// 用于追踪组件渲染次数的计数器
function useRenderCount(label: string) {
  const count = useRef(0)
  // 教学演示：render 阶段立即追踪渲染次数。
  // 生产代码不推荐在 render 中修改 ref，这里为了教学直观展示。
  // eslint-disable-next-line react-hooks/refs
  count.current += 1
  // eslint-disable-next-line react-hooks/refs
  return { label, count: count.current }
}

// ========== 普通子组件：父组件渲染时也跟着渲染 ==========
function ExpensiveChildNormal({ value }: { value: number }) {
  const { count } = useRenderCount('ExpensiveChildNormal')
  // 模拟耗时计算
  const computed = Array.from({ length: 100000 }, (_, i) => value + i).reduce(
    (a, b) => a + b,
    0,
  )
  return (
    <Typography.Text>
      {count === 1 ? `NormalChild 渲染 ${count} 次，结果=${computed}` : `NormalChild 渲染 ${count} 次，结果=${computed}`}
    </Typography.Text>
  )
}

// ========== memo 子组件：props 不变则跳过重新渲染 ==========
const ExpensiveChildMemo = memo(function ExpensiveChildMemo({ value }: { value: number }) {
  const { count } = useRenderCount('ExpensiveChildMemo')
  // 用 useMemo 缓存计算结果，props 不变时避免重复计算
  const computed = useMemo(
    () =>
      Array.from({ length: 100000 }, (_, i) => value + i).reduce(
        (a, b) => a + b,
        0,
      ),
    [value],
  )
  return (
    <Typography.Text>
      MemoChild 渲染 {count} 次，结果={computed}
    </Typography.Text>
  )
})

// ========== 对比：memo + useCallback 组合 ==========
const ButtonWithCallback = memo(function ButtonWithCallback({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  const { count } = useRenderCount('ButtonWithCallback')
  return (
    <Button onClick={onClick}>
      {label}（渲染 {count} 次）
    </Button>
  )
})

export function RenderOptimization() {
  const [parentCount, setParentCount] = useState(0)
  const [childValue, setChildValue] = useState(1)

  // 每次渲染都创建新函数，memo 子组件会重新渲染
  const unstableCallback = () => {
    console.log('不稳定的函数引用')
  }

  // useCallback 稳定函数引用，依赖不变时返回同一函数
  const stableCallback = useCallback(() => {
    console.log('稳定的函数引用')
  }, [])

  // useMemo 缓存计算结果
  const doubled = useMemo(() => childValue * 2, [childValue])

  return (
    <Flex vertical gap={24}>
      <div>
        <Typography.Title level={3}>渲染优化</Typography.Title>
        <Alert
          type="info"
          showIcon
          message="核心：React.memo 浅比较 props 决定是否跳过渲染；useMemo 缓存值；useCallback 缓存函数引用。"
          description="注意：React Compiler（React 19）会自动插入这些优化，但理解手动优化的原理仍是面试必考。"
        />
      </div>

      <Card title="渲染计数对比" size="small">
        <Flex vertical gap={12}>
          <Flex gap={8} align="center">
            <Typography.Text strong>父组件渲染次数：</Typography.Text>
            <Statistic value={parentCount} />
          </Flex>
          <Space>
            <Button onClick={() => setParentCount(c => c + 1)}>父组件 +1</Button>
            <Button onClick={() => setChildValue(v => v + 1)}>
              子组件 value +1（当前 {childValue}）
            </Button>
          </Space>
          <Typography.Paragraph type="secondary">
            点击「父组件 +1」时：NormalChild 重新渲染（props 没变但父组件变了），MemoChild 不重新渲染（memo 拦截）。
            点击「子组件 value +1」时：两者都重新渲染（props 真的变了）。
          </Typography.Paragraph>
        </Flex>
      </Card>

      <Card title="React.memo 对比" size="small">
        <Flex vertical gap={12}>
          <ExpensiveChildNormal value={childValue} />
          <ExpensiveChildMemo value={childValue} />
          <Typography.Paragraph type="secondary">
            NormalChild 每次父组件渲染都执行（含 10 万次循环的耗时计算）。
            MemoChild 在 props 不变时跳过渲染，且 useMemo 缓存了计算结果。
          </Typography.Paragraph>
        </Flex>
      </Card>

      <Card title="useCallback 稳定函数引用" size="small">
        <Flex vertical gap={12}>
          <Flex gap={8}>
            <ButtonWithCallback label="不稳定引用" onClick={unstableCallback} />
            <ButtonWithCallback label="稳定引用" onClick={stableCallback} />
          </Flex>
          <Typography.Paragraph type="secondary">
            点击「父组件 +1」观察两个按钮的渲染次数：
            <br />- 不稳定引用：每次父组件渲染都传新函数，memo 失效
            <br />- 稳定引用：useCallback 返回同一函数，memo 生效跳过渲染
          </Typography.Paragraph>
        </Flex>
      </Card>

      <Card title="useMemo 缓存计算结果" size="small">
        <Flex vertical gap={8}>
          <Typography.Text>
            childValue = {childValue}，useMemo 结果（×2）= {doubled}
          </Typography.Text>
          <Typography.Paragraph type="secondary">
            只有当 childValue 变化时才重新计算。父组件 +1 不会触发重算。
          </Typography.Paragraph>
        </Flex>
      </Card>
    </Flex>
  )
}
