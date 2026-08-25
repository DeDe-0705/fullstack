import { Space, Tabs } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

export function CEndLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // index 路由 /c-end 默认落在「搜索联想」上，保证 Tabs 高亮正确
  const activeKey = pathname === '/c-end' ? '/c-end/search' : pathname

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: 16 }}>
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <Tabs
          activeKey={activeKey}
          onChange={(key) => navigate(key)}
          items={[
            { key: '/c-end/search', label: '搜索联想（防抖 + 竞态）' },
            { key: '/c-end/feed', label: 'Feed 无限滚动（useInfiniteQuery）' },
          ]}
        />
        <Outlet />
      </Space>
    </div>
  )
}
