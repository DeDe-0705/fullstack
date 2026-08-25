import type { Order, OrderPayload, Product } from './types'

// 纯前端 mock 数据：今天重点是 React 各库在场景中的职责边界，
// 而不是后端接口，所以用「本地数据 + 模拟延迟」让 TanStack Query 的 loading/缓存可被直观看到
export const MOCK_PRODUCTS: Product[] = [
  { id: 1, name: '无线降噪耳机', category: '数码', price: 899, stock: 32, description: '主动降噪，续航 30 小时' },
  { id: 2, name: '机械键盘 87 键', category: '数码', price: 499, stock: 18, description: '热插拔轴体，PBT 键帽' },
  { id: 3, name: '人体工学椅', category: '家居', price: 1599, stock: 8, description: '腰托可调，网布透气' },
  { id: 4, name: '便携咖啡机', category: '家居', price: 299, stock: 45, description: '一键萃取，USB 充电' },
  { id: 5, name: '跑步鞋', category: '运动', price: 699, stock: 60, description: '缓震回弹，透气鞋面' },
  { id: 6, name: '瑜伽垫', category: '运动', price: 129, stock: 90, description: '加厚防滑，附背带' },
  { id: 7, name: '程序员文化衫', category: '服饰', price: 99, stock: 200, description: '纯棉，梗图印花' },
  { id: 8, name: '通勤双肩包', category: '服饰', price: 259, stock: 75, description: '防泼水，独立电脑仓' },
]

// 模拟网络延迟：让 query 的 isPending 有存在感，也便于观察缓存命中后「秒开」
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchProducts(category?: string): Promise<Product[]> {
  await delay(600)
  const list = category && category !== '全部'
    ? MOCK_PRODUCTS.filter((p) => p.category === category)
    : MOCK_PRODUCTS
  // 返回浅拷贝，避免调用方意外修改「服务端」数据源
  return [...list]
}

export async function fetchProduct(id: number): Promise<Product> {
  await delay(500)
  const product = MOCK_PRODUCTS.find((p) => p.id === id)
  if (!product) throw new Error(`商品 ${id} 不存在`)
  return product
}

// 模拟下单：Redux createAsyncThunk 会调用它。通过全局开关可模拟失败，观察 rejected 分支
let shouldFail = false
export function setShouldFailNextOrder(v: boolean) {
  shouldFail = v
}

export async function submitOrder(payload: OrderPayload): Promise<Order> {
  await delay(1200)
  if (shouldFail) {
    shouldFail = false
    throw new Error('模拟：支付网关超时')
  }
  return {
    id: `ORD-${Date.now()}`,
    items: payload.items,
    totalPrice: payload.totalPrice,
    address: payload.address,
    status: 'success',
    createdAt: Date.now(),
  }
}
