import { Button, Card, Col, Row, Space, Tag, Typography } from 'antd'
import { useAuthStore } from '../stores/authStore'

const capabilities = [
  {
    title: '鉴权下发',
    description: 'mock 登录态保存在 Zustand；接入子应用后通过 wujie props 下发 token/userInfo。',
  },
  {
    title: '路由分发',
    description: '统一入口 /micro/:name/*，host 负责激活子应用，子应用内部路由后续由无界同步回 URL。',
  },
  {
    title: '菜单权限',
    description: 'subApps 注册表按 roles 过滤菜单，对应简历里“编码控制子应用菜单权限展示”。',
  },
  {
    title: '通信与性能',
    description: '下一阶段补 bus 事件、preloadApp 预加载、alive 保活与 CDN/版本配置叙事。',
  },
]

export default function Dashboard() {
  const { user, loading, login } = useAuthStore()

  return (
    <Space direction="vertical" size="large" className="w-full">
      <div>
        <Typography.Title level={3}>React 微前端父应用</Typography.Title>
        <Typography.Paragraph type="secondary">
          当前阶段只搭 host 壳：登录 mock、菜单权限、子应用注册表和路由模型；真实子应用下一阶段再接。
        </Typography.Paragraph>
        {!user && (
          <Button type="primary" loading={loading} onClick={login}>
            mock 登录查看权限菜单
          </Button>
        )}
      </div>

      <Row gutter={[16, 16]}>
        {capabilities.map((item) => (
          <Col xs={24} md={12} key={item.title}>
            <Card title={item.title}>
              <Typography.Paragraph type="secondary" className="!mb-0">
                {item.description}
              </Typography.Paragraph>
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="面试叙事锚点">
        <Space wrap>
          <Tag color="blue">Li People：Vue3 + wujie</Tag>
          <Tag color="green">本项目：React host 复刻治理模型</Tag>
          <Tag color="purple">鉴权 / 路由 / 通信 / 性能</Tag>
        </Space>
      </Card>
    </Space>
  )
}
