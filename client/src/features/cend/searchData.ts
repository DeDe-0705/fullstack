import { MOCK_PRODUCTS } from '../shop/mockApi'

export interface SearchResult {
  id: number
  name: string
  category: string
  price: number
}

// 搜索词库：商品名 + 分类名，模拟后端联想词接口
const SEARCH_CORPUS = MOCK_PRODUCTS.map((p) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  price: p.price,
}))

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 关键：queryFn 拿到 signal，TanStack Query 在新请求到来时会 abort 上一个请求，
// 从根源上避免「旧结果覆盖新结果」的竞态问题（比单纯比对请求序号更彻底）
export async function searchProducts(
  term: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  await delay(450)
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const keyword = term.trim().toLowerCase()
  if (!keyword) return []
  return SEARCH_CORPUS.filter(
    (item) =>
      item.name.toLowerCase().includes(keyword) ||
      item.category.toLowerCase().includes(keyword),
  )
}
