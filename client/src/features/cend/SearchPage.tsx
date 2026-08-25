import { useQuery } from '@tanstack/react-query'
import { Alert, Card, Input, List, Space, Tag, Typography } from 'antd'
import { useDeferredValue, useState, type ReactNode } from 'react'
import { searchProducts } from './searchData'
import { useDebounce } from './useDebounce'

// 高亮匹配词：用 React 元素分段渲染，而不是 dangerouslySetInnerHTML，
// 从根本上避免用户输入被当成 HTML 注入（XSS）
function highlight(text: string, keyword: string) {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return text
  const lower = text.toLowerCase()
  const parts: ReactNode[] = []
  let start = 0
  let index = lower.indexOf(kw)
  while (index !== -1) {
    parts.push(text.slice(start, index))
    parts.push(<mark key={index}>{text.slice(index, index + kw.length)}</mark>)
    start = index + kw.length
    index = lower.indexOf(kw, start)
  }
  parts.push(text.slice(start))
  return parts
}

export function SearchPage() {
  const [input, setInput] = useState('')
  // 防抖：降低请求频率，用户停下 300ms 后才真正发出请求
  const debounced = useDebounce(input, 300)
  // useDeferredValue：把「联想列表渲染」标记为低优先级，
  // 输入框本身保持流畅，React 会在空闲时再渲染结果
  const deferred = useDeferredValue(debounced)

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['search', deferred],
    // signal 自动传入：新输入到来时，TanStack Query 会 abort 旧请求，避免旧结果覆盖新结果
    queryFn: ({ signal }) => searchProducts(deferred, signal),
    enabled: deferred.trim().length > 0,
    staleTime: 30_000,
  })

  return (
    <Card title="搜索联想（useDebounce + useDeferredValue + TanStack Query 竞态处理）">
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Input.Search
          allowClear
          size="large"
          placeholder="输入商品名或分类，如：数码 / 耳机 / 键盘"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Space size="large">
          <Typography.Text type="secondary">原始输入：{input || '-'}</Typography.Text>
          <Typography.Text type="secondary">防抖后：{debounced || '-'}</Typography.Text>
          <Typography.Text type="secondary">
            请求词：{deferred || '-'} {isFetching ? '（请求中...）' : ''}
          </Typography.Text>
        </Space>

        {isError && <Alert type="error" message={(error as Error).message} />}

        {data && data.length === 0 && deferred.trim() && (
          <Alert type="info" message="没有匹配结果" />
        )}

        <List
          bordered
          loading={isFetching}
          dataSource={data ?? []}
          renderItem={(item) => (
            <List.Item>
              <Space>
                <Tag color="blue">{item.category}</Tag>
                <span>{highlight(item.name, deferred)}</span>
                <Typography.Text type="danger">¥{item.price}</Typography.Text>
              </Space>
            </List.Item>
          )}
        />
      </Space>
    </Card>
  )
}
