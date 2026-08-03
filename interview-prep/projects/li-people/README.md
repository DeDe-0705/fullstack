# Li People 门户 — 面试要点

> 项目时间：2024.03 - 2026.04 | 角色：项目 Owner
> 技术栈：Vue3 + TypeScript + 无界(wujie)微前端 + Ant G6

---

## 一、项目一句话介绍

> "Li People 是理想汽车面向 HRBP、ER、OD 等角色的 OA 门户平台，集成人事管理、组织管理等业务模块。我主导了微前端架构落地，解决多团队独立开发部署的问题，同时负责鉴权、路由、通信、性能四大核心能力建设。"

---

## 二、项目背景与痛点

```
背景：
  理想汽车职能业务线有多个业务域（人事/组织/薪酬/文化等），
  每个业务都有自己的系统，独立管理权限，技术栈不同，
  分布在不同的代码库中。

痛点：
  1. 技术栈不统一 — 老系统 Vue2/jQuery，新系统 Vue3/React，
     无法统一技术栈，也没法整体升级
  2. 公共组件重复开发 — 每个系统都有自己的组织选择器、人员选择器，
     改一个组件要同时改多个代码库，版本发布互相等待
  3. 权限控制混乱 — 各系统各自实现权限逻辑，有的用前端路由守卫，
     有的用接口拦截，标准不统一，安全有隐患
  4. 用户体验割裂 — 从人事系统跳到组织系统要重新登录、重新加载，
     页面风格不统一，操作路径不连贯
  5. 无法跨业务联动 — 想在一个页面里同时看到人事和组织的数据，
     需要开多个系统来回切换，效率低
```

**面试话术：**

> "Li People 要解决的核心问题是：职能业务线有多个独立系统，技术栈不统一、权限各自管理、公共组件重复开发。比如组织选择器组件，人事系统、薪酬系统、文化系统各写了一份，改需求要同时改三个代码库。而且各系统权限逻辑不一致，有的是前端路由守卫，有的是接口拦截，安全有隐患。我们想做一个统一门户，把这些系统整合起来，统一鉴权、统一权限、统一组件库。"

---

## 三、核心架构方案

### 3.1 微前端选型：为什么选无界不选 qiankun

**选型理念：**

> "其实没有最好的微前端方案，只有最适合业务的方案。我们选 Wujie，并不是因为它技术最先进，而是因为它和我们的业务特点匹配。B 端项目最重要的是快速接入、低改造成本和稳定运行。Wujie 利用 iframe 提供天然的 JS 沙箱，减少了对子应用的改造；Shadow DOM 又解决了样式隔离问题。虽然它在部分 DOM 计算场景会有兼容性问题，但这些问题在我们的业务里是少数，而且都有成熟的规避方案。所以综合开发成本、维护成本和用户体验，我们最终选择了 Wujie。"

**对比表：**

| 对比维度 | qiankun | 无界 (wujie) | 选择原因 |
|---------|---------|-------------|---------|
| JS 隔离 | Proxy 沙箱（同一 window） | iframe 物理隔离（独立 window） | 存量系统技术栈混乱（Vue2/jQuery/Vue3），全局变量污染严重，物理隔离更彻底 |
| CSS 隔离 | Shadow DOM / Scoped CSS | iframe 天然隔离 | 老系统样式没有规范，需要完全隔离 |
| 接入成本 | 需要暴露生命周期 | 几乎零改造 | 存量系统难以改造，有的甚至是 jQuery 项目 |
| 保活能力 | ❌ | ✅ | B 端多 tab 场景需要保留状态 |
| 弹窗问题 | 无 | 内置解决 | qiankun 需要手动处理 |
| 技术栈兼容 | 需要统一构建工具 | 任意技术栈 | 我们有 Vue2/Vue3/jQuery 混合的老系统 |

**面试话术：**

> "选型时主要对比了 qiankun 和无界。我们的场景比较特殊：存量系统技术栈很乱，有 Vue2、Vue3，甚至还有 jQuery 的老系统。qiankun 需要子应用暴露 bootstrap/mount/unmount 生命周期，对老系统改造成本高，而且 Proxy 沙箱在同一 window 下，全局变量污染风险大。无界基于 iframe + WebComponent，子应用几乎零改造接入，物理隔离天然解决了技术栈混乱的问题。虽然 Wujie 在部分 DOM 计算场景（如 vxe-table 虚拟滚动、Element Plus 弹窗定位）有兼容性问题，但这些问题在我们的业务里是少数，而且都有成熟的规避方案。综合开发成本、维护成本和用户体验，最终选择无界。"

### 3.2 整体架构图

```
┌─────────────────────────────────────────┐
│           Li People 门户 (host)          │
│  ┌──────────┐ ┌──────────┐              │
│  │ 统一鉴权   │ │ 统一权限   │  ← 核心：解决权限混乱问题
│  ├──────────┤ ├──────────┤              │
│  │ 路由分发   │ │ 通信总线   │              │
│  ├──────────┤ ├──────────┤              │
│  │ 公共组件库  │ │ 全局状态   │  ← 核心：解决组件重复开发
│  └──────────┘ └──────────┘              │
├─────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐            │
│  │人事系统│ │组织系统│ │薪酬系统│  ...      │
│  │(Vue2)│ │(Vue3)│ │(jQuery)│  ← 技术栈不统一
│  │(子应用)│ │(子应用)│ │(子应用)│            │
│  └──────┘ └──────┘ └──────┘            │
│         无界(wujie)容器                  │
│  ┌─────────────────────────┐            │
│  │  iframe 物理隔离         │  ← 解决技术栈混乱
│  │  WebComponent 打通       │  ← 解决弹窗/路由/DOM 问题
│  └─────────────────────────┘            │
└─────────────────────────────────────────┘
```

### 3.3 四大核心能力

#### 能力一：鉴权 — 统一登录态

**问题：** 子应用独立部署、技术栈不同（Vue2/Vue3/jQuery），如何共享登录态？

**方案：** 独立鉴权 SDK，支持 NPM + CDN 双渠道分发

**为什么不直接用 Props 注入？**

> "Props 注入适合简单的数据下发，但鉴权涉及登录、登出、token 刷新、过期重登等复杂逻辑，如果通过 Props 下发，每个子应用都要自己实现这些逻辑，容易不一致。我们把鉴权逻辑封装成独立的 SDK，所有应用（包括主应用和子应用）都引用同一个 NPM 包，保证行为统一。"

**双渠道分发：**

| 渠道 | 适用场景 | 接入方式 |
|------|---------|---------|
| **NPM** | 新项目（Vue2/Vue3/React） | `npm install @li-people/auth-sdk` |
| **CDN** | 老项目（jQuery/无构建工具） | `<script src="https://cdn.lixiang.com/auth-sdk/1.2.0/index.js">` |

**SDK 构建配置（同时输出 ESM + UMD）：**

```typescript
// packages/auth-sdk/vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'LiAuthSDK',  // UMD 全局变量名
      formats: ['es', 'umd'],  // 同时输出 ESM 和 UMD
      fileName: (format) => `index.${format === 'es' ? 'js' : 'umd.js'}`
    },
    rollupOptions: {
      // 不打包依赖，由使用方提供
      external: [],
      output: {
        // UMD 格式挂载到 window.LiAuthSDK
        globals: {}
      }
    }
  }
})
```

**NPM 包配置：**

```json
// packages/auth-sdk/package.json
{
  "name": "@li-people/auth-sdk",
  "version": "1.2.0",
  "main": "dist/index.umd.js",      // CommonJS 入口
  "module": "dist/index.js",        // ESM 入口
  "types": "dist/index.d.ts",       // TypeScript 类型
  "unpkg": "dist/index.umd.js",     // CDN 默认入口
  "files": ["dist"],
  "scripts": {
    "build": "vite build",
    "publish:npm": "npm publish",
    "publish:cdn": "aws s3 sync dist/ s3://cdn-bucket/auth-sdk/$npm_package_version/"
  }
}
```

**CDN 部署流程：**

```yaml
# .gitlab-ci.yml
stages:
  - build
  - publish-npm
  - publish-cdn

build:
  script:
    - pnpm install
    - pnpm build
  artifacts:
    paths:
      - dist/

publish-npm:
  script:
    - npm publish
  only:
    - tags

publish-cdn:
  script:
    # 上传到 CDN，带版本号目录
    - aws s3 sync dist/ s3://cdn-bucket/auth-sdk/$CI_COMMIT_TAG/
    # 同时更新 latest 目录
    - aws s3 sync dist/ s3://cdn-bucket/auth-sdk/latest/
  only:
    - tags
```

```typescript
// packages/auth-sdk/src/index.ts
// 独立鉴权 SDK，发布为 NPM 包 @li-people/auth-sdk

interface AuthConfig {
  appId: string                    // 应用 ID（用于权限隔离）
  loginUrl: string                 // 登录页地址
  tokenRefreshUrl: string          // token 刷新接口
  userInfoUrl: string              // 用户信息接口
  permissionsUrl: string           // 权限接口
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  userInfo: UserInfo | null
  permissions: string[]
  tokenExpireTime: number | null
}

class AuthSDK {
  private config: AuthConfig
  private state: AuthState
  private refreshTimer: number | null = null
  
  constructor(config: AuthConfig) {
    this.config = config
    this.state = {
      token: null,
      refreshToken: null,
      userInfo: null,
      permissions: [],
      tokenExpireTime: null
    }
    
    // 从 localStorage 恢复登录态
    this.restoreFromStorage()
  }
  
  // 登录
  async login(username: string, password: string): Promise<void> {
    const res = await fetch(`${this.config.loginUrl}`, {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })
    const data = await res.json()
    
    this.state.token = data.token
    this.state.refreshToken = data.refreshToken
    this.state.tokenExpireTime = Date.now() + data.expiresIn * 1000
    
    // 保存到 localStorage（跨子应用共享）
    localStorage.setItem('li_auth_token', data.token)
    localStorage.setItem('li_auth_refresh_token', data.refreshToken)
    localStorage.setItem('li_auth_expire_time', this.state.tokenExpireTime.toString())
    
    // 获取用户信息和权限
    await this.fetchUserInfo()
    await this.fetchPermissions()
    
    // 启动自动刷新
    this.startAutoRefresh()
  }
  
  // 登出
  async logout(): Promise<void> {
    // 清除本地状态
    this.state = {
      token: null,
      refreshToken: null,
      userInfo: null,
      permissions: [],
      tokenExpireTime: null
    }
    
    // 清除 localStorage
    localStorage.removeItem('li_auth_token')
    localStorage.removeItem('li_auth_refresh_token')
    localStorage.removeItem('li_auth_expire_time')
    
    // 停止自动刷新
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
    }
    
    // 调用后端登出接口
    await fetch(`${this.config.loginUrl}/logout`, { method: 'POST' })
    
    // 跳转到登录页
    window.location.href = '/login'
  }
  
  // 获取 token（自动处理过期刷新）
  async getToken(): Promise<string> {
    // 检查是否过期
    if (this.isTokenExpired()) {
      await this.refreshToken()
    }
    return this.state.token!
  }
  
  // 刷新 token
  private async refreshToken(): Promise<void> {
    const res = await fetch(this.config.tokenRefreshUrl, {
      method: 'POST',
      body: JSON.stringify({ refreshToken: this.state.refreshToken })
    })
    const data = await res.json()
    
    this.state.token = data.token
    this.state.tokenExpireTime = Date.now() + data.expiresIn * 1000
    
    // 更新 localStorage
    localStorage.setItem('li_auth_token', data.token)
    localStorage.setItem('li_auth_expire_time', this.state.tokenExpireTime.toString())
  }
  
  // 检查 token 是否过期
  private isTokenExpired(): boolean {
    if (!this.state.tokenExpireTime) return true
    // 提前 5 分钟刷新
    return Date.now() > this.state.tokenExpireTime - 5 * 60 * 1000
  }
  
  // 自动刷新 token
  private startAutoRefresh(): void {
    const checkInterval = 60 * 1000  // 每分钟检查一次
    
    this.refreshTimer = window.setInterval(() => {
      if (this.isTokenExpired()) {
        this.refreshToken()
      }
    }, checkInterval)
  }
  
  // 获取用户信息
  async fetchUserInfo(): Promise<UserInfo> {
    const token = await this.getToken()
    const res = await fetch(this.config.userInfoUrl, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    this.state.userInfo = data
    return data
  }
  
  // 获取应用权限
  async fetchPermissions(): Promise<string[]> {
    const token = await this.getToken()
    const res = await fetch(`${this.config.permissionsUrl}?appId=${this.config.appId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    this.state.permissions = data.permissions
    return data.permissions
  }
  
  // 检查权限
  hasPermission(permission: string): boolean {
    return this.state.permissions.includes(permission)
  }
  
  // 从 localStorage 恢复登录态
  private restoreFromStorage(): void {
    const token = localStorage.getItem('li_auth_token')
    const expireTime = localStorage.getItem('li_auth_expire_time')
    
    if (token && expireTime) {
      this.state.token = token
      this.state.tokenExpireTime = parseInt(expireTime)
      
      // 如果已过期，尝试刷新
      if (this.isTokenExpired()) {
        this.refreshToken()
      } else {
        this.startAutoRefresh()
      }
    }
  }
  
  // 过期重登（监听 401）
  handleUnauthorized(): void {
    // 清除状态
    this.logout()
    // 跳转登录页
    window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname)
  }
}

// 导出单例
export const authSDK = new AuthSDK({
  appId: 'li-people-portal',
  loginUrl: '/api/auth/login',
  tokenRefreshUrl: '/api/auth/refresh',
  userInfoUrl: '/api/auth/userinfo',
  permissionsUrl: '/api/auth/permissions'
})
```

**主应用使用：**

```typescript
// apps/host/src/main.ts
import { authSDK } from '@li-people/auth-sdk'

// 初始化鉴权
if (!authSDK.state.token) {
  // 未登录，跳转登录页
  window.location.href = '/login'
} else {
  // 已登录，获取用户信息和权限
  await authSDK.fetchUserInfo()
  await authSDK.fetchPermissions()
}

// 请求拦截器：自动带 token
axios.interceptors.request.use(async (config) => {
  const token = await authSDK.getToken()
  config.headers.Authorization = `Bearer ${token}`
  return config
})

// 响应拦截器：401 时过期重登
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authSDK.handleUnauthorized()
    }
    return Promise.reject(error)
  }
)
```

**子应用使用（Vue2/Vue3/React 通过 NPM）：**

```typescript
// packages/hr-module/src/utils/request.ts
import { authSDK } from '@li-people/auth-sdk'
import axios from 'axios'

const request = axios.create({
  baseURL: '/api/hr'
})

// 请求拦截器：自动带 token
request.interceptors.request.use(async (config) => {
  const token = await authSDK.getToken()  // 自动处理过期刷新
  config.headers.Authorization = `Bearer ${token}`
  return config
})

// 响应拦截器：401 时过期重登
request.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authSDK.handleUnauthorized()
    }
    return Promise.reject(error)
  }
)

// 权限判断
export function checkPermission(permission: string): boolean {
  return authSDK.hasPermission(permission)
}
```

**jQuery 老系统使用（通过 CDN script 引入）：**

```html
<!-- legacy-system/index.html -->
<!DOCTYPE html>
<html>
<head>
  <!-- 通过 CDN 引入 SDK -->
  <script src="https://cdn.lixiang.com/auth-sdk/1.2.0/index.umd.js"></script>
</head>
<body>
  <script>
    // UMD 格式挂载到 window.LiAuthSDK
    const authSDK = window.LiAuthSDK.authSDK
    
    // 初始化（自动从 localStorage 恢复登录态）
    if (!authSDK.state.token) {
      // 未登录，跳转登录页
      window.location.href = '/login'
    }
    
    // 发请求前获取 token
    function ajaxWithAuth(url, options) {
      authSDK.getToken().then(token => {
        $.ajax({
          url: url,
          headers: {
            'Authorization': 'Bearer ' + token
          },
          ...options
        })
      })
    }
    
    // 使用示例
    ajaxWithAuth('/api/employees', {
      method: 'GET',
      success: function(data) {
        console.log('员工列表', data)
      },
      error: function(xhr) {
        if (xhr.status === 401) {
          authSDK.handleUnauthorized()
        }
      }
    })
    
    // 权限判断
    if (authSDK.hasPermission('employee:edit')) {
      $('#edit-btn').show()
    }
  </script>
</body>
</html>
```

**无构建工具的老项目（直接 script 标签）：**

```html
<!-- 老项目没有打包工具，直接引入 CDN -->
<script src="https://cdn.lixiang.com/auth-sdk/1.2.0/index.umd.js"></script>
<script>
  // 立即执行初始化
  (function() {
    const authSDK = window.LiAuthSDK.authSDK
    
    // 页面加载时检查登录态
    document.addEventListener('DOMContentLoaded', function() {
      if (!authSDK.state.token) {
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname)
      }
    })
  })()
</script>
```

**面试追问：为什么要支持 NPM + CDN 双渠道？**

> "因为子应用技术栈不统一：新项目（Vue3/React）用 NPM 管理依赖，可以享受 Tree-Shaking、类型提示等能力；老项目（jQuery/无构建工具）没有打包工具，只能通过 `<script>` 标签引入 CDN 资源。SDK 同时输出 ESM 和 UMD 两种格式，ESM 给 NPM 用，UMD 给 CDN 用，保证所有项目都能接入。"

**面试追问：CDN 版本怎么管理？**

> "CDN 路径带版本号：`https://cdn.lixiang.com/auth-sdk/1.2.0/index.umd.js`。老项目升级版本只需要改 script 标签的版本号。同时维护一个 `latest` 目录指向最新版本，新项目可以直接用 `latest`，老项目锁定具体版本号保证稳定性。"

**面试追问：为什么不用 Props 注入 token？**

> "三个原因：1) Props 注入只能父到子单向传递，token 刷新后主应用要通知所有子应用更新，通过 Props 做不到；2) 鉴权逻辑复杂（登录、登出、刷新、过期重登），如果通过 Props 下发，每个子应用都要自己实现，容易不一致；3) 独立 SDK 可以统一处理 token 过期、自动刷新、错误重试，子应用只需要调用 `getToken()`，不用关心细节。"

**面试追问：token 存储在哪里？localStorage 安全吗？**

> "token 存储在 localStorage，这样可以在多个子应用之间共享。安全性方面：1) token 有效期短（2小时），配合 refreshToken 自动刷新；2) 所有接口走 HTTPS；3) 敏感操作（如修改密码）需要二次验证；4) 如果安全要求更高，可以改为 httpOnly Cookie，但需要后端配合设置 SameSite 和 CORS。"

#### 能力二：路由 — 同步与恢复

**问题：** 子应用路由变化如何同步到主应用 URL？刷新后如何恢复？

**Wujie 路由同步的核心机制：**

> "Wujie 中主应用和子应用各自维护自己的路由实例，并不会共享同一个 history。子应用运行在 iframe 中，拥有独立的 history 和 location。为了支持刷新恢复和浏览器前进后退，Wujie 会代理子应用的 history.pushState、replaceState 等 API，当子应用发生路由变化时，会将子应用当前路由同步到主应用的 URL（通常编码到查询参数中）。这样浏览器地址栏始终反映了主应用和子应用的组合状态，刷新页面时，Wujie 再从主应用 URL 中恢复子应用路由，实现路由同步，而不破坏 iframe 的运行环境隔离。"

**路由同步的三层机制：**

```
第一层：子应用路由变化
  子应用在 iframe 中执行 history.pushState('/hr/employee/123')
  ↓
第二层：Wujie 代理 history API
  Wujie 劫持子应用的 pushState，将子应用路由同步到主应用 URL
  主应用 URL: /hr?wujie_id=hr-module&wujie_path=/employee/123
  ↓
第三层：刷新恢复
  用户刷新页面，主应用根据 URL 激活 hr-module
  Wujie 从 URL 中提取 wujie_path=/employee/123
  子应用恢复时，执行 pushState('/hr/employee/123') 还原路由
```

**实际实现：**

```typescript
// Wujie 路由同步的底层实现（简化版）
class RouterSync {
  private iframe: HTMLIFrameElement
  private appName: string
  
  constructor(iframe: HTMLIFrameElement, appName: string) {
    this.iframe = iframe
    this.appName = appName
    
    this.proxyHistory()
  }
  
  private proxyHistory() {
    const iframeWindow = this.iframe.contentWindow!
    const iframeHistory = iframeWindow.history
    
    // 代理 pushState
    const originalPushState = iframeHistory.pushState.bind(iframeHistory)
    iframeHistory.pushState = (state: any, title: string, url: string) => {
      // 执行原始的 pushState（子应用内部路由变化）
      originalPushState(state, title, url)
      
      // 同步到主应用 URL
      this.syncToMainURL(url)
    }
    
    // 代理 replaceState（同理）
    const originalReplaceState = iframeHistory.replaceState.bind(iframeHistory)
    iframeHistory.replaceState = (state: any, title: string, url: string) => {
      originalReplaceState(state, title, url)
      this.syncToMainURL(url)
    }
  }
  
  private syncToMainURL(subAppPath: string) {
    // 将子应用路由编码到主应用 URL 的查询参数中
    const mainURL = new URL(window.location.href)
    mainURL.searchParams.set('wujie_id', this.appName)
    mainURL.searchParams.set('wujie_path', subAppPath)
    
    // 更新主应用 URL（不触发页面刷新）
    window.history.replaceState(null, '', mainURL.toString())
  }
  
  // 刷新恢复（Wujie 内部自动处理）
  static restoreFromURL(): { appName: string, path: string } | null {
    const mainURL = new URL(window.location.href)
    const appName = mainURL.searchParams.get('wujie_id')
    const path = mainURL.searchParams.get('wujie_path')
    
    if (appName && path) {
      return { appName, path }
    }
    return null
  }
  
  // Wujie 内部会在子应用激活时自动调用此方法
  // 从 URL 中提取 wujie_path，然后执行子应用的 pushState 恢复路由
  // 不需要主应用或子应用手动监听事件
}
```

**主应用路由配置：**

```typescript
// apps/host/src/router/index.ts
const routes = [
  {
    path: '/hr/:pathMatch(.*)*',  // 匹配 /hr 下的所有路径
    component: () => import('@/views/HrModule.vue'),
    meta: { appName: 'hr-module' }
  },
  {
    path: '/org/:pathMatch(.*)*',
    component: () => import('@/views/OrgModule.vue'),
    meta: { appName: 'org-module' }
  }
]

// 子应用容器组件
// apps/host/src/views/HrModule.vue
<template>
  <WujieVue
    name="hr-module"
    :url="hrModuleUrl"
    :sync="true"          <!-- 开启路由同步 -->
    :alive="true"         <!-- 开启保活 -->
  />
</template>

<!-- 
  注意：开启 sync: true 后，Wujie 会自动处理路由恢复，
  不需要手动监听事件。Wujie 会：
  1. 从主应用 URL 中提取 wujie_path
  2. 自动恢复子应用的路由状态
-->
```

**子应用路由配置（无需额外处理）：**

```typescript
// packages/hr-module/src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory('/hr'),  // 子应用的基础路径
  routes: [
    { path: '/employee/:id', component: () => import('@/views/EmployeeDetail.vue') },
    { path: '/roster', component: () => import('@/views/Roster.vue') }
  ]
})

// 注意：开启 sync: true 后，Wujie 会自动处理路由恢复
// 子应用不需要监听任何事件，路由恢复由 Wujie 内部完成

export default router
```

**URL 示例：**

```
用户访问子应用的 /hr/employee/123
  ↓
Wujie 同步到主应用 URL:
  https://li-people.lixiang.com/hr?wujie_id=hr-module&wujie_path=/employee/123
  ↓
用户刷新页面:
  主应用根据 wujie_id=hr-module 激活 hr-module
  Wujie 自动从 URL 中提取 wujie_path=/employee/123
  Wujie 自动恢复子应用路由到 /employee/123（无需手动监听事件）
```

**面试追问：为什么要用查询参数编码子应用路由？**

> "因为主应用和子应用各自维护独立的路由实例，不能直接共享 history。用查询参数编码子应用路由（如 `?wujie_id=hr-module&wujie_path=/employee/123`），可以让主应用 URL 同时反映主应用和子应用的状态。刷新页面时，主应用根据 `wujie_id` 激活对应的子应用，再根据 `wujie_path` 恢复子应用内部的路由。这样既支持刷新恢复，又不破坏 iframe 的运行环境隔离。"

**面试追问：浏览器前进后退怎么处理？**

> "Wujie 会监听主应用的 popstate 事件。当用户点击浏览器前进/后退按钮时，主应用的 URL 会变化，Wujie 自动从 URL 中提取 `wujie_id` 和 `wujie_path`，然后：1) 如果是同一个子应用的路由变化，Wujie 自动恢复子应用路由；2) 如果是切换到另一个子应用，Wujie 先激活对应的子应用，再自动恢复路由。整个过程不需要主应用或子应用手动监听事件，Wujie 内部自动完成。"

**面试追问：路由恢复需要主应用或子应用监听事件吗？**

> "不需要。开启 `sync: true` 后，Wujie 内部会自动处理路由恢复：1) 子应用路由变化时，Wujie 自动同步到主应用 URL；2) 刷新页面时，Wujie 自动从 URL 中提取 `wujie_path` 并恢复子应用路由；3) 浏览器前进后退时，Wujie 自动监听 popstate 事件并恢复路由。主应用和子应用都不需要手动监听任何事件，路由同步和恢复完全由 Wujie 内部完成。"

**面试追问：多个子应用同时保活，内存会不会爆？**

> "会控制保活数量，只保留最近访问的 2-3 个子应用。同时子应用内部做了优化：大组件懒加载、离开页面时清理定时器和事件监听。"

#### 能力三：通信 — Props + Bus 双通道

**问题：** 父子应用如何通信？跨子应用如何通信？

**方案：** Props 单向数据流 + Bus 事件总线

```typescript
// 父 → 子：Props 下发（主题、语言等全局状态）
<WujieVue :props="{ theme: appStore.theme, locale: appStore.locale }" />

// 子应用监听 Props 变化
watch(() => window.$wujie?.props?.theme, (newTheme) => {
  document.documentElement.setAttribute('data-theme', newTheme)
})

// 子 → 父：Bus 事件（选中员工后通知主应用更新面包屑）
window.$wujie?.bus.$emit('employee-selected', { id, name, path })

// 跨子应用：Bus 事件（组织模块更新部门 → 人事模块刷新列表）
window.$wujie?.bus.$emit('department-updated', dept)
```

**面试话术：**

> "通信分两种场景：Props 用于父到子的单向数据下发，比如主题、语言、鉴权信息；Bus 用于事件通知，比如子应用选中员工后通知主应用更新面包屑，或者跨子应用的数据联动。原则是尽可能单向数据流，避免子应用之间直接耦合。"

**面试追问：Wujie 的 Props 底层是怎么传递的？能传复杂对象吗？**

> "Wujie 的 props **并不是通过 postMessage 或 JSON 序列化传递的**，而是在创建子应用 iframe 后，利用同源环境可以访问 `iframe.contentWindow` 的能力，将 Wujie 的运行时对象挂载到子应用的 window 上，例如 `window.__WUJIE`，其中包含 props、事件总线、路由信息等运行时数据。子应用直接从 `window.__WUJIE.props` 中读取，主应用更新 props 时 Wujie 会同步更新这份运行时对象。
>
> 所以**普通对象、数组、函数、Date、Map/Set 都可以直接传**，因为走的是引用传递，同源 iframe 共享同一个 JS 堆内存。但 **DOM 节点、React Ref、WebSocket、响应式对象** 等与运行环境强绑定的对象不建议传——虽然技术上能传过去，但语义会出问题：比如响应式对象，子应用直接修改会绕过主应用的响应式追踪，导致数据流向失控。这类场景我们会把共享对象提升到主应用管理，通过 Bus 事件或统一 SDK 暴露能力，而不是直接共享对象本身。"

```typescript
// Wujie 内部实现（简化版）：挂载运行时对象到子应用 window
function mountWujieRuntime(iframe: HTMLIFrameElement, props: Record<string, any>) {
  const iframeWindow = iframe.contentWindow!
  // 同源 iframe，可以直接操作子应用的 window
  iframeWindow.__WUJIE = {
    id: 'hr-module',
    props,                // ← 直接挂载对象引用，非序列化
    bus: new EventBus(),
    shadowRoot,
  }
}

// 主应用更新 props 时：同步更新运行时对象
function updateProps(iframe: HTMLIFrameElement, newProps: Record<string, any>) {
  iframe.contentWindow!.__WUJIE.props = newProps  // 直接替换引用
}
```

**可传递 vs 不建议传递的对象：**

| 类型 | 是否可以传递 | 说明 |
|------|------------|------|
| 普通对象 / 数组 / 函数 / Date / Map/Set | ✅ 可以 | 引用传递，无需序列化 |
| DOM 节点 / React Ref | ❌ 不建议 | 与各自运行环境强绑定，应各自应用管理 |
| WebSocket | ❌ 不建议 | 主应用统一维护，子应用通过 Bus 事件使用 |
| 响应式对象 | ⚠️ 能传但不建议 | 子应用修改会绕过主应用响应式追踪，数据流失控 |

**不建议传递的对象的替代方案：**

```typescript
// WebSocket：主应用维护，只暴露 send 方法 + Bus 广播收到的消息
// 主应用
const wsManager = new WebSocketManager()
window.$wujie = {
  bus: new EventBus(),
  ws: { send: (data) => wsManager.send(data) }  // 只暴露方法，不暴露连接本身
}

// 子应用
window.$wujie.ws.send({ type: 'chat', message: 'Hello' })
window.$wujie.bus.$on('ws-message', (data) => { /* ... */ })

// 响应式对象：传快照 + Bus 事件驱动更新
// 主应用监听子应用的更新请求，由主应用统一修改
window.$wujie?.bus.$on('update-form', (data) => Object.assign(formState, data))
<WujieVue :props="{ formData: { ...formState } }" />  // 传快照，不传响应式对象本身
```

**面试追问：既然 Props 不走序列化，那"不可序列化"的问题还存在吗？**

> "Props 本身不走序列化，所以函数、Date、Map/Set 都能直接传。只有**持久化场景**——比如把状态存到 localStorage 或编码到 URL 上——才需要序列化，此时 Date 转 ISO 字符串、Set 转 Array、Map 转 Object 需要手动处理。另外工具函数还有第二种共享方式：通过 jsBeforeLoaders 直接挂载到子应用 window，和依赖共享是同一套机制。"

---

#### 补充：Wujie 沙箱隔离的核心机制

**Wujie 的双层架构（精准总结）：**

> "Wujie 采用 iframe + WebComponent 的组合方案。iframe 主要提供独立的浏览器运行环境，实现 JavaScript 沙箱以及 window、document、history 等全局对象的隔离；WebComponent（Shadow DOM）负责承载子应用的真实渲染内容，并提供样式隔离。为了让运行在 iframe 中的子应用能够把页面渲染到 Shadow DOM，Wujie 会代理（重定向）子应用的 DOM API，把原本操作 iframe document 的行为映射到对应的 ShadowRoot 上，因此实现了 **JS 在 iframe 中执行、DOM 在父页面中渲染** 的效果。"

**架构图：**

```
主应用 DOM
  └── <wujie-app>                    ← WebComponent（Shadow DOM 承载渲染）
        └── #shadow-root (open)      ← 子应用的真实 DOM 渲染在这里
              └── 子应用的 <div id="app">...</div>
        
  └── iframe (隐藏)                   ← 子应用的 JS 运行环境
        └── 子应用的 window/document  ← JS 沙箱隔离
```

**核心机制：DOM API 代理**

Wujie 劫持子应用的 DOM API，把操作 iframe document 的行为映射到 ShadowRoot：

```typescript
// Wujie 内部实现（简化版）
class WujieSandbox {
  private iframe: HTMLIFrameElement
  private shadowRoot: ShadowRoot
  
  constructor(iframe: HTMLIFrameElement, shadowRoot: ShadowRoot) {
    this.iframe = iframe
    this.shadowRoot = shadowRoot
    
    // 代理子应用的 document
    this.proxyDocument()
  }
  
  private proxyDocument() {
    const iframeDocument = this.iframe.contentDocument!
    
    // 劫持 createElement：创建的元素挂载到 ShadowRoot
    const originalCreateElement = iframeDocument.createElement.bind(iframeDocument)
    iframeDocument.createElement = (tagName: string) => {
      const element = originalCreateElement(tagName)
      // 元素创建后，实际挂载到 ShadowRoot
      return element
    }
    
    // 劫持 querySelector：查询 ShadowRoot 内的元素
    iframeDocument.querySelector = (selector: string) => {
      if (selector === 'body') {
        return this.shadowRoot.querySelector('#app')  // 返回 ShadowRoot 的挂载点
      }
      return this.shadowRoot.querySelector(selector)
    }
    
    // 劫持 appendChild：挂载到 ShadowRoot
    const originalAppendChild = iframeDocument.body.appendChild.bind(iframeDocument.body)
    iframeDocument.body.appendChild = (element: HTMLElement) => {
      // 弹窗类元素挂载到主应用 body
      if (element.classList.contains('modal')) {
        return document.body.appendChild(element)
      }
      // 普通元素挂载到 ShadowRoot
      return this.shadowRoot.appendChild(element)
    }
  }
}
```

**核心问题与解决方案：**

| 问题 | 解决方案 | 效果 |
|------|---------|------|
| 子应用 `document.querySelector('body')` | 返回 ShadowRoot 的挂载点 | 子应用认为自己在操作 body，实际操作 ShadowRoot |
| 子应用 `document.body.appendChild` | 弹窗类元素挂载到主应用 body，普通元素挂载到 ShadowRoot | Element Plus Modal 覆盖整个页面 |
| 子应用 `document.getElementById('app')` | 返回 ShadowRoot 内的挂载点 | ECharts 等库正常工作 |
| 主应用获取子应用元素 | 通过 `wujieApp.shadowRoot.querySelector(...)` | 可以操作子应用 DOM |
| 事件冒泡 | 通过 Shadow DOM 穿透 | 主应用和子应用互相监听事件 |

**实际效果：**

```javascript
// 子应用内的代码（运行在 iframe 的 JS 沙箱中）
const app = document.getElementById('app')
// → 实际返回 ShadowRoot 内的 <div id="app"> ✅

app.innerHTML = '<h1>Hello</h1>'
// → 实际修改 ShadowRoot 内的 DOM，父页面可见 ✅

// 子应用内使用 Element Plus
ElMessage.success('操作成功')
// → document.body.appendChild 被劫持，挂载到主应用 body ✅

// 子应用内使用 ECharts
echarts.init(document.getElementById('chart'))
// → getElementById 返回 ShadowRoot 内的元素 ✅

// 主应用监听子应用点击事件
document.querySelector('wujie-app').addEventListener('click', (e) => {
  console.log('子应用被点击', e.target)  // ✅ 事件穿透
})
```

**面试话术：**

> "Wujie 的核心是 **JS 在 iframe 中执行、DOM 在父页面中渲染**。iframe 提供 JS 沙箱隔离（window/document/history 独立），WebComponent 的 Shadow DOM 承载真实渲染内容并提供样式隔离。Wujie 通过代理子应用的 DOM API，把操作 iframe document 的行为映射到 ShadowRoot 上，这样子应用认为自己在操作正常的 document，实际上 DOM 渲染在父页面的 ShadowRoot 中。这让子应用完全无感知，Element Plus、ECharts 等第三方库不需要修改就能正常工作。"

---

#### 能力四：性能 — 预加载 + 预执行 + 保活

**问题：** 微前端最大的体验瓶颈在两点：一是**首次进入子应用慢**——要下载 HTML、JS、CSS，再解析执行、挂载渲染，白屏时间动辄 1-2 秒；二是**切换子应用时重新挂载**——组件状态、滚动位置、表单输入全部丢失，体验远逊于单页应用。如何让子应用"秒开"？

**方案：** 预加载三层机制（解决首次慢）+ 保活/单例分级策略（解决切换慢），辅以依赖共享减小资源体积

**面试话术（总览）：**

> "性能优化我们主要围绕两个场景：首次进入和再次切换。首次进入靠 Wujie 的预加载三层机制——资源预加载、预执行、激活，把下载和解析提前到浏览器空闲时完成，用户点进来直接挂载；再次切换靠保活机制，切换时不销毁 iframe 和组件树，回来直接复用。另外通过 jsBeforeLoaders 做依赖共享，把 lodash、axios 这些公共库注入子应用 window，子应用构建时 external 掉，资源体积减小了 23%。最终效果是：首次进入白屏减少 60%，切换体验接近单页应用。"

---

##### 1. 预加载：三层机制（核心）

```
第一层：资源预加载（requestIdleCallback 空闲调度）
  - 只下载 JS/CSS 静态资源到内存，不解析执行
  - 单独开一个隐藏 iframe 进行下载，不抢占主线程

第二层：预执行（exec: true + Fiber 加速）
  - 解析 JS、执行顶层代码（注册路由、初始化 store）
  - Fiber 把大 JS 拆成小任务分批执行，不阻塞主线程

第三层：激活（activate）
  - 用户真正进入时挂载 DOM、触发 mounted
  - 前两层已完成，激活速度极快（< 100ms）
```

```typescript
// 底层原理（简化版）：requestIdleCallback 空闲时下载资源
function preloadApp(options: PreloadOptions) {
  const preloadIframe = document.createElement('iframe')
  preloadIframe.style.display = 'none'
  document.body.appendChild(preloadIframe)

  requestIdleCallback(() => {
    fetch(`${options.url}/js/app-[hash].js`)  // 只下载，不解析
      .then(res => res.arrayBuffer())
      .then(buffer => resourceCache.set(url, buffer))
  }, { timeout: 2000 })  // 超时强制执行，防止浏览器一直忙
}
```

**配合 Fiber 的子应用构建优化（包分片）：**

```typescript
// 子应用构建时把包分片更多，每个 chunk < 200KB，Fiber 调度更灵活
manualChunks: {
  'vue-vendor': ['vue', 'vue-router', 'pinia'],
  'ui-vendor': ['element-plus'],
  'hr-employee': ['./src/views/Employee'],
  'hr-roster': ['./src/views/Roster'],
}
// 不分包：app.js 800KB，Fiber 一次性解析阻塞 50ms+
// 分包后：每个 chunk 150KB 左右，Fiber 分批解析不阻塞
```

**实际使用：按流量优先级分级预加载**

```typescript
// 高频（HR、组织）：立即预加载 + 预执行
preloadApp({ name: 'hr-module', url: '...', exec: true })

// 中频（薪酬）：延迟 3 秒，只做资源预加载
setTimeout(() => preloadApp({ name: 'salary-module', url: '...', exec: false }), 3000)

// 低频（文化）：用户行为触发（悬停菜单时预加载）
menuEl.addEventListener('mouseenter', () => preloadApp({ ... }), { once: true })
```

**面试追问：预加载的三层机制是什么？**

> "Wujie 预加载分三层：1) 资源预加载：只下载 JS/CSS 到内存，不解析执行，单独开隐藏 iframe 下载，用 requestIdleCallback 空闲调度，我觉得哪些子应用流量大，就设置这些优先加载；2) 预执行（exec: true）：解析 JS、执行顶层代码，Wujie 用 Fiber 架构加速，把大的 JS 文件拆分成小任务分批执行；3) 激活：用户进入子应用时挂载 DOM，由于前两层已完成，激活速度极快。我们高频应用会做预执行，低频应用只做资源预加载。"

**面试追问：requestIdleCallback 有什么缺点？**

> "两个缺点：1) 兼容性，Safari 不支持，需要 polyfill 或降级为 setTimeout；2) 执行时机不确定，如果浏览器一直忙可能永远不执行。Wujie 的解决方案是设置 timeout（默认 2000ms），超时后强制执行。"

**面试追问：预加载会不会影响首屏性能？**

> "不会，因为 requestIdleCallback 只在浏览器空闲时执行，首屏渲染完成后才开始预加载。我们实测首屏 LCP 2.1s，预加载在 2.5s 后开始。但预加载会占用带宽，所以限制同时预加载的应用数量最多 2 个。"

---

##### 2. 保活：真正的 KeepAlive

**面试追问：保活的底层原理是什么？**

> "Wujie 的保活不是重新渲染，而是真正意义上的 KeepAlive。首次进入时创建 iframe、ShadowRoot 并完成子应用初始化；切换离开时，不执行子应用的卸载逻辑，也不销毁 iframe、DOM 或 JS 运行环境，而是将容器从页面中移除并缓存在缓存池中。再次进入时，直接复用缓存的 iframe 和 ShadowRoot，将 DOM 重新挂回页面——React/Vue 不会重新执行 mount、render 或 setup，组件状态、Pinia 数据、滚动位置、输入框内容，甚至未清理的定时器都会保持原样。这也是切换速度快的主要原因，同时也要求开发者在应用失活时主动暂停定时器、轮询等后台任务。"

**保活模式 vs 单例模式：**

| 维度 | 保活模式（alive: true） | 单例模式（默认） |
|------|----------------------|----------------|
| iframe / JS 运行环境 | 保留 | 保留 |
| DOM / 组件树 | 保留（不执行 unmount） | 销毁（执行 unmount，重新 mount） |
| 组件状态（Pinia/Redux） | 保留 | 丢失（重新 mount 时重置） |
| 滚动位置 / 表单输入 | 保留 | 重置 / 清空 |
| 定时器 / 轮询 | 继续运行（需手动暂停） | 清除（unmount 时清理） |
| 切换速度 | 极快（< 50ms） | 较快（< 200ms） |
| 内存占用 | 高 | 中 |

```typescript
// 实际使用：按应用频率分级
<WujieVue name="hr-module" :alive="true" :maxAliveCount="3" />   // 高频：保活
<WujieVue name="salary-module" :alive="false" />                 // 中频：单例
<WujieVue name="culture-module" :alive="false" :degrade="true"/> // 低频：降级普通 iframe

// 保活数量控制（LRU）：超过 maxAliveCount 销毁最早的应用
// 子应用监听 deactivate 事件，主动暂停定时器和轮询
```

**面试追问：保活模式有什么坑？**

> "最大的坑是定时器和轮询不会自动清理。保活模式下 JS 运行环境完全保留，如果子应用有 setInterval 或轮询请求，切换离开后还会继续运行，造成内存泄漏和不必要的网络请求。我们的解决方案：1) 子应用监听 deactivate 事件主动暂停；2) 主应用限制保活数量 maxAliveCount: 3，LRU 销毁最早的；3) 监控内存占用，超阈值手动销毁。"

**面试追问：保活和单例模式怎么选？**

> "三个维度：1) 切换频率：高频用保活，低频用单例；2) 状态重要性：需要保留表单输入、滚动位置（如花名册筛选）用保活，状态不重要用单例；3) 内存占用：保活内存高，单例内存低。我们的策略：高频保活（HR、组织），中频单例（薪酬），低频降级为普通 iframe（文化）。"

**面试追问：保活和预加载有什么关系？**

> "两个独立机制，但可以配合：预加载让**首次**进入更快（提前下载/预执行），保活让**再次**进入更快（不销毁直接复用）。高频应用既预加载又保活，中频只预加载不保活，低频两者都不用。"

---

##### 3. 辅助手段：依赖共享（减小资源体积）

预加载解决"加载时机"问题，依赖共享解决"加载体积"问题——资源越小，预加载和激活越快：

```typescript
// 主应用：把公共库挂载到 window，通过 jsBeforeLoaders 注入子应用
window._ = lodash
window.axios = axios
window.dayjs = dayjs

WujieVue.setupApp({
  name: 'hr-module',
  jsBeforeLoaders: [{
    callback: (iframeWindow: Window) => {
      iframeWindow._ = window._
      iframeWindow.axios = window.axios
      iframeWindow.dayjs = window.dayjs
    }
  }]
})

// 子应用：external 排除公共库，不打包，直接用 window._
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['lodash', 'axios', 'dayjs'],
      output: { globals: { lodash: '_', axios: 'axios', dayjs: 'dayjs' } }
    }
  }
})
```

**面试追问：为什么用 jsBeforeLoaders 而不是 Props？**

> "Props 适合传递数据（如 token、userInfo），但公共库是代码不是数据。jsBeforeLoaders 是 Wujie 提供的插件机制，在子应用 JS 加载前执行，可以把主应用的 window 对象注入到子应用的 iframe window 上。这样子应用直接用 `window._` 就能访问 lodash，不需要 import，也不需要打包。jQuery 老项目也能直接通过 script 使用。"

**面试追问：如果子应用需要不同版本的 lodash 怎么办？**

> "两个方案：1) 主应用挂载多个版本，如 `window._v4`、`window._v3`，子应用按需取用；2) 子应用确实需要独立版本，就不 external，自己打包一份。实际项目中我们会统一升级到同一个大版本，避免版本碎片化。"

---

**性能数据（面试加分项）：**

> "预加载 + 预执行让首次进入子应用的白屏时间减少 60%；保活机制让切换子应用做到 50ms 内无感切换，体验接近单页应用；依赖共享减少了 200KB 重复代码（23%），CDN + hash 文件名强缓存让二次加载从 2s 降到 200ms。"

---

## 四、核心业务模块

### 4.1 花名册多维度筛选

**需求：** HRBP 需要按部门、职级、入职时间等多维度筛选员工

**实现：**

```typescript
// packages/hr-module/src/views/Roster/FilterPanel.vue
interface FilterCondition {
  departments: string[]      // 部门多选
  jobLevels: string[]        // 职级多选
  hireDateRange: [string, string]  // 入职时间范围
  keywords: string           // 关键词（姓名/工号）
}

// 筛选逻辑
const filteredEmployees = computed(() => {
  return employees.value.filter(emp => {
    // 部门筛选
    if (filters.departments.length && !filters.departments.includes(emp.deptId)) {
      return false
    }
    // 职级筛选
    if (filters.jobLevels.length && !filters.jobLevels.includes(emp.jobLevel)) {
      return false
    }
    // 时间范围筛选
    if (filters.hireDateRange[0] && emp.hireDate < filters.hireDateRange[0]) {
      return false
    }
    if (filters.hireDateRange[1] && emp.hireDate > filters.hireDateRange[1]) {
      return false
    }
    // 关键词模糊匹配
    if (filters.keywords) {
      const kw = filters.keywords.toLowerCase()
      return emp.name.toLowerCase().includes(kw) || 
             emp.employeeId.includes(kw)
    }
    return true
  })
})
```

**面试追问：数据量大怎么办？**

> "目前花名册数据量在几千级别，前端筛选够用。如果到万级，会考虑后端筛选 + 虚拟列表。虚拟列表已经在另一个模块实现了，可以复用。"

### 4.2 Ant G6 组织架构图

**需求：** 可视化展示组织架构，支持展开/收起、搜索定位、拖拽调整

**实现：**

```typescript
// packages/org-module/src/components/OrgChart.vue
import G6 from '@antv/g6'

const graph = new G6.TreeGraph({
  container: 'org-chart-container',
  width: 1200,
  height: 800,
  modes: {
    default: ['drag-canvas', 'zoom-canvas']
  },
  defaultNode: {
    type: 'rect',
    size: [180, 60],
    style: {
      fill: '#fff',
      stroke: '#e0e0e0',
      radius: 4
    },
    labelCfg: {
      style: {
        fontSize: 14,
        fill: '#333'
      }
    }
  },
  defaultEdge: {
    type: 'cubic-vertical',
    style: {
      stroke: '#c0c0c0'
    }
  },
  layout: {
    type: 'compactBox',
    direction: 'TB',
    getHeight: () => 80,
    getWidth: () => 200
  }
})

// 数据懒加载：点击展开时才请求子部门
graph.on('node:click', async (evt) => {
  const { item } = evt
  const model = item.getModel()
  
  if (!model.children || model.children.length === 0) {
    // 请求子部门数据
    const children = await fetchSubDepartments(model.id)
    graph.updateChild(model.id, children)
  }
})

// 搜索定位
function locateEmployee(employeeId: string) {
  const node = graph.findById(employeeId)
  if (node) {
    graph.focusItem(node, true, {
      easing: 'easeCubic',
      duration: 500
    })
    // 高亮显示
    graph.setItemState(node, 'selected', true)
  }
}
```

**面试追问：组织架构层级很深，性能怎么优化？**

> "做了三层优化：1) 数据懒加载，点击展开时才请求子部门；2) 虚拟渲染，只渲染可视区域内的节点；3) 防抖处理，拖拽和缩放时延迟重新计算布局。"

---

## 五、工程化建设

### 5.1 子应用部署规范

```yaml
# .gitlab-ci.yml (子应用)
stages:
  - build
  - deploy

build:
  script:
    - pnpm install
    - pnpm build
  artifacts:
    paths:
      - dist/

deploy:
  script:
    # 上传 CDN，带版本号目录
    - aws s3 sync dist/ s3://cdn-bucket/hr-module/$CI_COMMIT_TAG/
    # 更新配置中心版本号
    - curl -X POST "https://config-center/api/apps/hr-module/version" \
           -d '{"version": "$CI_COMMIT_TAG"}'
  only:
    - tags  # 打 tag 才触发部署
```

**主应用版本管理：**

```typescript
// apps/host/src/config/apps.ts
interface AppConfig {
  name: string
  version: string
  url: string
}

// 从配置中心获取最新版本号
async function getAppConfig(appName: string): Promise<AppConfig> {
  const res = await fetch(`/api/config-center/apps/${appName}`)
  const { version } = await res.json()
  return {
    name: appName,
    version,
    url: `https://cdn.lixiang.com/${appName}/${version}/index.html`
  }
}
```

### 5.2 公共组件库建设

```typescript
// packages/ui-kit/src/components/EmployeeSelect/index.vue
<template>
  <el-select
    v-model="selectedValue"
    :remote-method="searchEmployees"
    :loading="loading"
    filterable
    remote
    placeholder="搜索员工"
  >
    <el-option
      v-for="emp in employeeList"
      :key="emp.id"
      :label="`${emp.name} (${emp.employeeId})`"
      :value="emp.id"
    />
  </el-select>
</template>

// 发布为 NPM 包，所有子应用统一使用
// packages/ui-kit/package.json
{
  "name": "@li-people/ui-kit",
  "version": "1.5.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}
```

---

## 六、高频面试题

### Q1: 微前端解决了什么问题？为什么不用 iframe 直接用？

> "微前端解决多团队独立开发部署的问题。直接用 iframe 有三大痛点：1) 弹窗只覆盖 iframe 区域；2) 路由不同步；3) DOM 不在同一棵树。无界通过 WebComponent 解决了这些问题，同时保留了 iframe 的隔离优势。"

### Q2: 子应用之间样式会不会互相影响？

> "无界用 iframe 承载子应用，天然 CSS 隔离。但有一个边界情况：如果子应用用 `document.body.appendChild` 挂载全局弹窗，会挂载到主应用 body 上。无界通过 DOM 劫持把这类操作代理到 Shadow DOM 内部，避免污染主应用。"

### Q3: 如果重新做一次，你会怎么改进？

> "三个方向：1) 引入 Module Federation 做模块级共享，减少公共依赖重复加载；2) 建设更完善的前端监控体系，错误追踪到具体子应用；3) 探索 SSR 方案，进一步提升首屏性能。"

---

## 七、项目亮点总结

| 亮点 | 说明 | 面试价值 |
|------|------|----------|
| 微前端架构落地 | 无界选型 + 四大核心能力建设 | 差异化优势，大部分候选人没有完整微前端经验 |
| 鉴权方案设计 | Props 注入 + 请求拦截器 + Token 刷新 | 体现系统设计能力 |
| 性能优化体系 | CDN + 预加载 + 保活 + 公共依赖抽离 | 体现性能优化思维 |
| G6 可视化 | 组织架构图 + 懒加载 + 搜索定位 | 体现复杂交互实现能力 |
| 工程化建设 | CI/CD + 版本管理 + 组件库 | 体现工程化能力 |
