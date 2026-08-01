import {
  ApartmentOutlined,
  DashboardOutlined,
  DownOutlined,
  LoginOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { App as AntdApp, Button, Dropdown, Layout, Menu, Space, Tag, Typography } from 'antd'
import type { MenuProps } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { canAccessSubApp, subApps } from '../config/subApps'
import { useAppStore } from '../stores/appStore'
import { useAuthStore } from '../stores/authStore'

export default function PortalLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { message } = AntdApp.useApp()
  const { collapsed, toggleCollapsed } = useAppStore()
  const { user, loading, login, logout } = useAuthStore()

  const visibleSubApps = subApps.filter((app) => canAccessSubApp(app, user?.roles ?? []))

  const menuItems: MenuProps['items'] = [
    { key: '/', icon: <DashboardOutlined />, label: '微前端总览' },
    ...visibleSubApps.map((app) => ({
      key: app.path,
      icon: app.name === 'hr' ? <TeamOutlined /> : <ApartmentOutlined />,
      label: app.status === 'planned' ? `${app.title}（待接入）` : app.title,
    })),
  ]

  const selectedKey =
    visibleSubApps.find((app) => pathname === app.path || pathname.startsWith(`${app.path}/`))
      ?.path ?? '/'

  const handleLogout = () => {
    logout()
    message.success('已退出 mock 登录')
  }

  const userMenuItems: MenuProps['items'] = [
    { key: 'logout', icon: <LogoutOutlined />, label: '退出 mock 登录' },
  ]

  return (
    <Layout className="min-h-screen">
      <Layout.Sider
        theme="light"
        width={260}
        collapsible
        collapsed={collapsed}
        trigger={null}
        className="!fixed !inset-y-0 !left-0 border-r border-gray-200"
      >
        <div className="flex h-16 items-center px-5">
          <Typography.Title level={4} className="!mb-0">
            {collapsed ? 'MH' : 'micro-host'}
          </Typography.Title>
        </div>
        <Menu
          mode="inline"
          items={menuItems}
          selectedKeys={[selectedKey]}
          onClick={({ key }) => navigate(key)}
        />
      </Layout.Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 260 }}>
        <Layout.Header className="flex items-center justify-between border-b border-gray-200 bg-white px-6">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleCollapsed}
          />
          {user ? (
            <Space size="middle">
              <Space size={4}>
                {user.roles.map((role) => (
                  <Tag key={role} color="blue">
                    {role}
                  </Tag>
                ))}
              </Space>
              <Dropdown
                menu={{
                  items: userMenuItems,
                  onClick: ({ key }) => {
                    if (key === 'logout') handleLogout()
                  },
                }}
              >
                <Button type="text">
                  {user.name} <DownOutlined />
                </Button>
              </Dropdown>
            </Space>
          ) : (
            <Button type="primary" icon={<LoginOutlined />} loading={loading} onClick={login}>
              mock 登录
            </Button>
          )}
        </Layout.Header>
        <Layout.Content className="bg-gray-50 p-6">
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
