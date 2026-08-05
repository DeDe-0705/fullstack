import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App as AntApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { router } from './router'
import { queryClient } from './lib/queryClient'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={zhCN}>
      {/* App 提供 message/notification 上下文，配合 App.useApp() 使用 */}
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          {/* 开发工具：可视化查看缓存内容/状态，调试学习利器（只影响开发环境） */}
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
)
