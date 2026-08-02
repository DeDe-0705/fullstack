# @king-dede/auth

微前端父子应用共用的登录鉴权 SDK：登录/登出、accessToken 管理与 refreshToken 续期、鉴权过期重新登录、用户信息、按应用维度的资源权限，所有事件经内置 bus 广播，**不依赖 wujie props / bus 通信**。

## 使用

```ts
import { createAuth } from '@king-dede/auth'

// SDK 不绑定 HTTP 库，接入方注入接口适配器（父/子应用各自实现）
const auth = createAuth({
  appId: 'micro-host',
  storageKey: 'micro-host-auth', // 父子应用约定一致
  adapter: {
    login: (credentials) => post('/api/login', credentials),
    refresh: (refreshToken) => post('/api/refresh', { refreshToken }),
    getUserInfo: () => get('/api/user'),
    getPermissions: (appId) => get(`/api/permissions?app=${appId}`),
  },
  onUnauthorized: () => (location.href = '/login'), // 鉴权过期兜底
})

// 登录 / 登出
await auth.login({ username, password })
auth.logout()

// token
auth.getAccessToken()              // 同步读取
await auth.getValidAccessToken()   // 临近过期自动用 refreshToken 续期（并发共享同一次刷新）
await auth.refreshAccessToken()    // 手动刷新

// 用户 / 权限
await auth.getUserInfo()           // 缓存优先，force=true 强制拉取
await auth.getPermissions()        // 按 appId 拉取当前应用资源权限
auth.hasPermission('order:export')

// 事件总线：login / logout / token-refreshed / token-expired / user-updated / permissions-updated
auth.on('token-expired', () => toast('登录已过期'))
auth.bus.on((event) => console.log(event.type))

// 状态快照订阅（React store 镜像用）
const off = auth.subscribe((state) => console.log(state.token, state.user))
```

## 跨应用同步原理（不走 wujie 通信）

1. 无界默认沙箱是**与主应用同源的 iframe**，子应用里的 `localStorage` 就是主应用的 `localStorage`，父子应用天然读写同一份登录态。
2. **状态同步**：写入方 commit 后，其他窗口收到原生 `storage` 事件，自动把最新登录态推给本窗口的 `subscribe` 订阅方。
3. **事件广播**：bus 事件写入 `${storageKey}:bus`，其他窗口在 `storage` 事件里重放 —— 父应用登录，子应用的 `auth.on('login')` 同样触发。
4. `storage` 事件只在**非写入方**窗口触发，与本窗口的直接通知互补，不会重复。

因此子应用只需 `npm i @king-dede/auth`，用同一 `storageKey` 调 `createAuth`，登录态与事件自动双向同步。

### 注意

- 若子应用跨域部署或 wujie 开启 `degrade` 降级，iframe 不再同源，此机制失效，需回退到 wujie props / bus 透传。
- 请求拦截器建议用 `await auth.getValidAccessToken()` 取 token，过期续期与并发去重由 SDK 处理。

## 发布流程

版本号与 CHANGELOG 由 [standard-version](https://github.com/conventional-changelog/standard-version) 管理，依据 [Conventional Commits](https://www.conventionalcommits.org/) 自动算 bump 级别（`feat` → minor、`fix` → patch、`BREAKING CHANGE` → major）。

```bash
# 首次发布：先构建，再生成首个完整 CHANGELOG（不 bump 版本）
pnpm build && pnpm exec standard-version --first-release

# 后续发布：rollup 构建（含类型检查）→ 自动 bump 版本 + 更新 CHANGELOG + 提交 + 打 tag
pnpm release        # 构建失败即中断；可加 --dry-run 预览

# 灰度 / 预发布：0.2.0-beta.0 → 0.2.0-beta.1 → ... 逐次递增
pnpm release:beta
git push --follow-tags && npm publish --tag beta   # 发到 beta dist-tag，不影响 latest

git push --follow-tags && npm publish   # 正式版；prepublishOnly 会自动再 build 一次
```
