import { Card, InputNumber, Statistic, Typography } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'

// 不定高虚拟滚动：
// 与定高的区别是——每项高度未知，无法用 itemHeight * index 直接定位。
// 核心思路：预估高度 + 实测高度缓存 + 二分查找 + ResizeObserver 测量修正。

interface ListItem {
  id: number
  title: string
  content: string
}

interface Position {
  index: number
  top: number
  height: number
  bottom: number
}

const ESTIMATED_HEIGHT = 60 // 预估高度：初始不知道真实高度，先按这个算
const OVERSCAN = 4 // 缓冲区：上下多渲染几项，避免快速滚动白屏
const CONTAINER_HEIGHT = 500 // 可视容器高度

// 生成「高度不定」的假数据：content 长度不同，真实高度由内容撑开决定
function generateItems(count: number): ListItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    title: `列表项 ${i}`,
    content: `这是第 ${i} 项的内容。` + '内容'.repeat(i % 10),
  }))
}

export function VariableVirtualList() {
  const [itemCount, setItemCount] = useState(1000)
  const items = useMemo(() => generateItems(itemCount), [itemCount])
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  // 实测高度缓存：index -> 真实高度
  const [measuredHeights, setMeasuredHeights] = useState<Record<number, number>>({})

  // positions 缓存：维护每项的 top / bottom（前缀和）
  // 实测高度变化时重算，位置逐步修正
  const positions = useMemo<Position[]>(() => {
    const pos: Position[] = []
    let top = 0
    for (let i = 0; i < items.length; i++) {
      // 内联：实测高度优先，未测量用预估
      const height = measuredHeights[i] ?? ESTIMATED_HEIGHT
      pos.push({ index: i, top, height, bottom: top + height })
      top += height
    }
    return pos
  }, [items, measuredHeights])

  const totalHeight = positions.length ? positions[positions.length - 1].bottom : 0

  // 二分查找：找到第一个 bottom > scrollTop 的项，作为起始 index
  const findStartIndex = (top: number) => {
    let low = 0
    let high = positions.length - 1
    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      if (positions[mid].bottom <= top) low = mid + 1
      else high = mid - 1
    }
    return Math.max(0, low - OVERSCAN)
  }

  // 二分查找：找到最后一个 top <= scrollBottom 的项，作为结束 index
  const findEndIndex = (bottom: number) => {
    let low = 0
    let high = positions.length - 1
    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      if (positions[mid].top <= bottom) low = mid + 1
      else high = mid - 1
    }
    return Math.min(positions.length - 1, high + OVERSCAN)
  }

  const startIndex = findStartIndex(scrollTop)
  const endIndex = findEndIndex(scrollTop + CONTAINER_HEIGHT)
  const offsetY = positions[startIndex]?.top ?? 0
  // 渲染的真实项（带真实 index）
  const visibleItems = items.slice(startIndex, endIndex + 1).map((item, i) => ({
    item,
    index: startIndex + i,
  }))

  // 测量实际高度：ResizeObserver 监听渲染项，实测后更新缓存
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({})

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const updates: Record<number, number> = {}
      for (const entry of entries) {
        const el = entry.target as HTMLDivElement
        const index = Number(el.dataset.index)
        const height =
          entry.borderBoxSize?.[0]?.blockSize ?? el.getBoundingClientRect().height
        if (height) updates[index] = height
      }
      if (Object.keys(updates).length > 0) {
        setMeasuredHeights((prev) => {
          // 只更新和缓存差异超过 1px 的高度，避免无谓重渲染
          const changed = Object.fromEntries(
            Object.entries(updates).filter(
              ([key, value]) =>
                Math.abs(value - (prev[Number(key)] ?? ESTIMATED_HEIGHT)) > 1,
            ),
          )
          return Object.keys(changed).length > 0 ? { ...prev, ...changed } : prev
        })
      }
    })
    Object.values(itemRefs.current).forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [visibleItems])

  // 滚动：rAF 节流，一帧内合并多次 scroll
  const handleScroll = () => {
    requestAnimationFrame(() => {
      setScrollTop(containerRef.current?.scrollTop ?? 0)
    })
  }

  return (
    <Card
      title="不定高虚拟滚动（预估高度 + 实测修正 + 二分查找）"
      extra={
        <Typography.Text>
          每项高度由内容撑开（未知），实测后动态修正位置
        </Typography.Text>
      }
    >
      <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
        <div>
          <div style={{ color: '#888', fontSize: 12 }}>总条数</div>
          <InputNumber
            min={10}
            max={10000}
            value={itemCount}
            onChange={(v) => setItemCount(v ?? 1000)}
          />
        </div>
        <Statistic title="实际渲染 DOM 数" value={visibleItems.length} />
        <Statistic title="已实测高度数" value={Object.keys(measuredHeights).length} />
        <Statistic title="scrollTop" value={scrollTop} />
        <Statistic title="起始 index" value={startIndex} />
        <Statistic title="结束 index" value={endIndex} />
        <Statistic title="offsetY" value={offsetY} suffix="px" />
        <Statistic title="总高度" value={Math.round(totalHeight)} suffix="px" />
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{ height: CONTAINER_HEIGHT, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 8 }}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleItems.map(({ item, index }) => (
            <div
              key={item.id}
              data-index={index}
              ref={(el) => {
                itemRefs.current[index] = el
              }}
              style={{
                position: 'absolute',
                top: positions[index]?.top ?? 0,
                left: 0,
                right: 0,
                padding: '8px 12px',
                borderBottom: '1px solid #f5f5f5',
                background: '#fff',
              }}
            >
              <div style={{ fontWeight: 600 }}>{item.title}</div>
              <div style={{ color: '#666' }}>{item.content}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
