import { useEffect, useState } from 'react'

// 防抖：value 停止变化 delay 毫秒后才更新返回值。
// 与节流不同：节流是「固定间隔执行一次」，防抖是「冷却时间内重复触发就重置计时」
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    // cleanup：value 或 delay 变化时清掉上一个定时器，实现「重置冷却」
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
