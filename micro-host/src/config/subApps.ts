import { subAppUrls } from '../env'

export type SubAppStatus = 'planned' | 'ready'

export interface SubAppConfig {
  /** 子应用唯一名，后续也是 wujie 的 name */
  name: string
  title: string
  /** host 菜单路由，/micro/:name */
  path: string
  /** 子应用入口；当前阶段为空，接入时通过 VITE_SUB_* 配置 */
  url: string
  /** 菜单权限编码：拥有任一角色即可见 */
  roles: string[]
  preload: boolean
  alive: boolean
  status: SubAppStatus
  description: string
}

export const subApps: SubAppConfig[] = [
  {
    name: 'ui-kit',
    title: 'UI Kit 展示站',
    path: '/micro/ui-kit',
    url: subAppUrls.uiKit,
    roles: ['admin', 'hrbp', 'manager', 'employee'],
    preload: false,
    alive: false,
    status: 'ready',
    description: '临时联调子应用：本地 ui-kit showcase（http://localhost:5173/）',
  },
  {
    name: 'markdown',
    title: 'Markdown 渲染',
    path: '/micro/markdown',
    url: subAppUrls.markdown,
    roles: ['admin', 'hrbp', 'manager', 'employee'],
    preload: false,
    alive: false,
    status: 'ready',
    description: 'Vue 3 子应用：markstream-vue 流式 Markdown 渲染（http://localhost:5174/）',
  },
  {
    name: 'hr',
    title: '人事模块',
    path: '/micro/hr',
    url: subAppUrls.hr,
    roles: ['admin', 'hrbp'],
    preload: true,
    alive: true,
    status: 'planned',
    description: '花名册、人事操作，后续可接 React/Vue 子应用',
  },
  {
    name: 'org',
    title: '组织模块',
    path: '/micro/org',
    url: subAppUrls.org,
    roles: ['admin', 'hrbp', 'manager'],
    preload: false,
    alive: true,
    status: 'planned',
    description: '组织架构、岗序体系，简历中 G6 架构图可落到这里',
  },
  {
    name: 'culture',
    title: '文化模块',
    path: '/micro/culture',
    url: subAppUrls.culture,
    roles: ['admin', 'employee'],
    preload: false,
    alive: false,
    status: 'planned',
    description: '企业文化 UGC，对应简历中理想文化项目',
  },
]

export const getSubApp = (name?: string) => subApps.find((app) => app.name === name)

export const canAccessSubApp = (app: SubAppConfig, userRoles: string[]) =>
  app.roles.some((role) => userRoles.includes(role))
