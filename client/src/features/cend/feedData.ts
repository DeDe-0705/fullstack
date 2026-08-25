export interface FeedItem {
  id: number
  title: string
  author: string
  content: string
}

// 模拟一条按游标分页的信息流，共 47 条，每页 10 条
const TITLES = ['前端', 'React', 'Vue', '性能优化', '工程化', 'AI', '面试']
const AUTHORS = ['德德', 'Codex', '老王', '小明', '阿伟']

export const FEED_TOTAL = 47
export const PAGE_SIZE = 10

function makeItem(id: number): FeedItem {
  const t = TITLES[id % TITLES.length]
  const a = AUTHORS[id % AUTHORS.length]
  return {
    id,
    title: `${t}实战笔记 #${id}`,
    author: a,
    content: `这是第 ${id} 条信息流内容，用来演示 useInfiniteQuery 的游标分页与无限滚动。`,
  }
}

export interface FeedPage {
  items: FeedItem[]
  nextCursor: number | null
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 游标分页：cursor 是「下一页起始 id」，返回 nextCursor 或 null 表示没有更多
export async function fetchFeedPage(cursor: number): Promise<FeedPage> {
  await delay(700)
  if (cursor >= FEED_TOTAL) return { items: [], nextCursor: null }
  const end = Math.min(cursor + PAGE_SIZE, FEED_TOTAL)
  const items = Array.from({ length: end - cursor }, (_, i) => makeItem(cursor + i))
  return { items, nextCursor: end < FEED_TOTAL ? end : null }
}
