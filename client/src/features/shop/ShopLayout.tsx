import { Badge, Space, Tabs } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { selectCartCount, useCartStore } from './cartStore'

// 场景的二级布局：用 Tabs 做导航，key 即路由路径。
// 购物车角标数量直接从 Zustand 订阅，跨路由实时同步 —— 这就是「客户端全局状态」的典型用法
export function ShopLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const cartCount = useCartStore((s) => selectCartCount(s.items))

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: 16 }}>
      <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
        <Tabs
          activeKey={pathname.startsWith('/shop/product') ? '/shop' : pathname}
          onChange={(key) => navigate(key)}
          items={[
            { key: '/shop', label: '商品列表' },
            { key: '/shop/cart', label: '购物车' },
            { key: '/shop/checkout', label: '结算下单' },
          ]}
        />
        <Badge count={cartCount} showZero>
          <span style={{ padding: '4px 8px', borderRadius: 6, background: '#f5f5f5' }}>
            购物车
          </span>
        </Badge>
      </Space>
      <Outlet />
    </div>
  )
}
