import { useQuery } from '@tanstack/react-query'
import { useCartStore } from './cartStore'
import { productListOptions } from './queries'

export interface CartLine {
  productId: number
  name: string
  price: number
  quantity: number
  subtotal: number
}

// 把「购物车里的引用」(productId + quantity) join 成「可展示的行」。
// 商品主数据仍走 TanStack Query：在列表页已经缓存的情况下，这里直接命中缓存、不重复请求
export function useCartLines(): CartLine[] {
  const items = useCartStore((s) => s.items)
  const { data: products } = useQuery(productListOptions())

  if (!products) return []
  return items.flatMap((item) => {
    const product = products.find((p) => p.id === item.productId)
    if (!product) return []
    return [
      {
        productId: item.productId,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        subtotal: product.price * item.quantity,
      },
    ]
  })
}
