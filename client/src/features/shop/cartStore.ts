import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem } from './types'

interface CartState {
  items: CartItem[]
  addItem: (productId: number) => void
  removeItem: (productId: number) => void
  updateQuantity: (productId: number, quantity: number) => void
  clear: () => void
}

// 为什么购物车用 Zustand 而不是 Redux？
// 购物车是「客户端 UI 状态」：数据源不在服务端，生命周期短，逻辑简单（增删改数量）。
// Zustand 无需 Provider，用 selector 订阅最小切片，样板代码少，最适合这种轻量全局状态。
// persist 中间件自动把它同步到 localStorage，刷新页面购物车不丢。
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (productId) =>
        set((state) => {
          const exist = state.items.find((i) => i.productId === productId)
          if (exist) {
            return {
              items: state.items.map((i) =>
                i.productId === productId
                  ? { ...i, quantity: i.quantity + 1 }
                  : i,
              ),
            }
          }
          return { items: [...state.items, { productId, quantity: 1 }] }
        }),
      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        })),
      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId
              ? { ...i, quantity: Math.max(1, quantity) }
              : i,
          ),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: 'shop-cart' },
  ),
)

// 派生数据用普通函数计算，不塞进 store，避免「一份数据多处存」导致不一致
export function selectCartCount(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.quantity, 0)
}
