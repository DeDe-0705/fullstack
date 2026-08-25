import { useInfiniteQuery } from '@tanstack/react-query'
import { Alert, Card, List, Skeleton, Space, Tag, Typography } from 'antd'
import { useEffect, useRef } from 'react'
import { fetchFeedPage } from './feedData'

export function FeedPage() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam as number),
    initialPageParam: 0,
    // 上一页返回的 nextCursor 作为下一页的入参；返回 null 表示没有更多
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  // 底部哨兵：滚到可视区就触发下一页，避免手动监听 scroll 再计算距离
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '200px' }, // 提前 200px 预加载，减少等待感
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const items = data?.pages.flatMap((page) => page.items) ?? []

  return (
    <Card title="Feed 无限滚动（useInfiniteQuery + IntersectionObserver）">
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        {status === 'pending' && <Skeleton active paragraph={{ rows: 6 }} />}
        {status === 'error' && <Alert type="error" message="加载失败" />}

        <List
          dataSource={items}
          renderItem={(item) => (
            <List.Item key={item.id}>
              <List.Item.Meta
                title={item.title}
                description={`${item.author} · ${item.content}`}
              />
            </List.Item>
          )}
        />

        <div ref={sentinelRef} style={{ textAlign: 'center', padding: 8 }}>
          {isFetchingNextPage ? (
            <Tag color="processing">加载中...</Tag>
          ) : hasNextPage ? (
            <Tag>向下滚动加载更多</Tag>
          ) : (
            <Typography.Text type="secondary">已加载全部 {items.length} 条</Typography.Text>
          )}
        </div>
      </Space>
    </Card>
  )
}
