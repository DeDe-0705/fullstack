import { Card, Flex, List, Typography } from 'antd'

const STACK = [
  '前端：React 19 + TypeScript + Tailwind CSS v4 + React Router v7 + Zustand + Vite',
  '后端：NestJS',
  '包管理：pnpm',
]

export function About() {
  return (
    <Flex vertical gap={16}>
      <Typography.Title level={3}>关于</Typography.Title>
      <Typography.Paragraph type="secondary">
        这是一个通用全栈脚手架，包含前后端分离架构。
      </Typography.Paragraph>
      <Card title="技术栈">
        <List
          dataSource={STACK}
          renderItem={(item) => <List.Item>{item}</List.Item>}
        />
      </Card>
    </Flex>
  )
}
