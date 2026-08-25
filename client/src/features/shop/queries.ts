import { queryOptions } from '@tanstack/react-query'
import { fetchProduct, fetchProducts } from './mockApi'

// 商品列表：queryKey 把筛选条件 category 一并编码进去。
// 这样不同分类有独立缓存，切回「数码」时直接命中缓存，不再发请求 —— 这是 TanStack Query 的核心价值
export const productListOptions = (category?: string) =>
  queryOptions({
    queryKey: ['products', 'list', category ?? 'all'],
    queryFn: () => fetchProducts(category),
    // 列表数据不频繁变化，1 分钟内视为新鲜，避免每次切页都重新请求
    staleTime: 60_000,
  })

// 商品详情：key 精确到 id，列表页与详情页不会互相污染缓存
export const productDetailOptions = (id: number) =>
  queryOptions({
    queryKey: ['products', 'detail', id],
    queryFn: () => fetchProduct(id),
    staleTime: 60_000,
  })
