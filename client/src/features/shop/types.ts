// 电商场景的领域类型：把商品数据建模清楚，后面 Router / Query / 状态库都围绕它展开
export interface Product {
  id: number
  name: string
  category: string
  price: number
  stock: number
  description: string
}

// 购物车条目：只存「引用 + 数量」，价格等详情回源查询，避免客户端状态与商品数据不一致
export interface CartItem {
  productId: number
  quantity: number
}

// 下单入参：由结算页从 Zustand 购物车读出来组装，再交给 Redux thunk 提交
export interface OrderPayload {
  items: CartItem[]
  totalPrice: number
  address: string
}

// 下单成功后返回的订单实体
export interface Order {
  id: string
  items: CartItem[]
  totalPrice: number
  address: string
  status: 'success'
  createdAt: number
}
