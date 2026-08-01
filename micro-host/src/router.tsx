import { createBrowserRouter } from 'react-router-dom'
import PortalLayout from './layouts/PortalLayout'
import Dashboard from './pages/Dashboard'
import MicroAppContainer from './pages/MicroAppContainer'
import NotFound from './pages/NotFound'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PortalLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      // 子应用统一入口：/micro/:name/*，* 部分留给子应用自己的 router
      { path: 'micro/:name/*', element: <MicroAppContainer /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
