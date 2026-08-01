import { createRoot } from 'react-dom/client'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import './index.css'

// 不包 StrictMode：wujie-react 是 class 组件，StrictMode 开发环境双挂载会把
// 内部 isUnmounted 置为 true，导致 startApp 直接 return，子应用空白且无报错。
createRoot(document.getElementById('root')!).render(
  <ConfigProvider locale={zhCN}>
    {/* AntdApp 提供 message/notification 上下文，避免脱离主题 */}
    <AntdApp>
      <RouterProvider router={router} />
    </AntdApp>
  </ConfigProvider>,
)
