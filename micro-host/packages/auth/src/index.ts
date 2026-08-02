/**
 * @king-dede/auth
 * 微前端父子应用共用的登录鉴权 SDK。
 *
 * 能力：
 * 1. 登录 / 登出，token（access + refresh）与用户信息统一持久化（localStorage）
 * 2. accessToken 过期自动用 refreshToken 续期（并发请求共享同一次刷新）
 * 3. 刷新失败 / 鉴权过期 → 清空登录态并触发重新登录回调
 * 4. 按应用维度获取资源权限
 * 5. 内置事件总线：所有事件（login/logout/token-refreshed/token-expired/...）
 *    经 bus 广播；无界同源 iframe 沙箱下通过 storage 事件跨窗口同步，
 *    子应用 `npm i @king-dede/auth` 即可使用，不依赖 wujie props / bus 通信。
 */

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string
  name: string
  roles: string[]
  [key: string]: unknown
}

export interface TokenBundle {
  accessToken: string
  refreshToken: string
  /** accessToken 过期时间戳（ms） */
  expiresAt: number
}

export interface AuthState {
  token: TokenBundle | null
  user: AuthUser | null
  /** 当前应用的资源权限码 */
  permissions: string[]
}

/** 登录接口返回：token 三元组 + 可选用户信息 */
export interface LoginResult {
  accessToken: string
  refreshToken: string
  /** accessToken 有效期（秒） */
  expiresIn: number
  user?: AuthUser
}

/**
 * 服务端接口适配器，由接入方注入。
 * SDK 不绑定具体 HTTP 库，父/子应用各自用 fetch / axios 实现即可。
 */
export interface AuthAdapter {
  login(credentials: unknown): Promise<LoginResult>
  refresh(refreshToken: string): Promise<LoginResult>
  getUserInfo(): Promise<AuthUser>
  /** appId 由 SDK 在调用时传入（options.appId） */
  getPermissions(appId: string): Promise<string[]>
}

export type AuthEventType =
  | 'login'
  | 'logout'
  | 'token-refreshed'
  | 'token-expired'
  | 'user-updated'
  | 'permissions-updated'

export interface AuthEvent {
  type: AuthEventType
  state: AuthState
}

export type AuthListener = (state: AuthState) => void
export type BusListener = (event: AuthEvent) => void

export interface AuthOptions {
  /** localStorage 存储 key，默认 'micro-host-auth'；父子应用需约定一致 */
  storageKey?: string
  /** 当前应用标识，获取资源权限时透传给 adapter */
  appId?: string
  /** 服务端接口适配器 */
  adapter: AuthAdapter
  /** 是否跨窗口同步（storage 事件），默认 true */
  sync?: boolean
  /** token 剩余有效期低于该值（ms）时 getValidAccessToken 触发刷新，默认 30s */
  refreshThreshold?: number
  /** 鉴权过期（refresh 失败）后的回调，父应用一般在这里跳转登录页 */
  onUnauthorized?: () => void
}

// ---------------------------------------------------------------------------
// 事件总线
// ---------------------------------------------------------------------------

class Bus {
  private listeners = new Set<BusListener>()

  on(listener: BusListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(event: AuthEvent): void {
    this.listeners.forEach((listener) => listener(event))
  }

  clear(): void {
    this.listeners.clear()
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const DEFAULT_STORAGE_KEY = 'micro-host-auth'
const DEFAULT_REFRESH_THRESHOLD = 30_000

export class Auth {
  /** 所有鉴权事件都经过该 bus 广播 */
  readonly bus = new Bus()

  private storageKey: string
  /** bus 跨窗口广播使用的 storage key（写入即触发其他窗口的 storage 事件） */
  private busKey: string
  private appId: string
  private adapter: AuthAdapter
  private refreshThreshold: number
  private onUnauthorized?: () => void
  private stateListeners = new Set<AuthListener>()
  /** 并发刷新去重：同一时间只允许一个 refresh 请求在途 */
  private refreshPromise: Promise<string> | null = null

  private onStorage = (event: StorageEvent): void => {
    if (event.key === this.storageKey) {
      // 其他窗口改写了登录态，同步给本窗口订阅方
      this.notifyState(this.read())
    } else if (event.key === this.busKey && event.newValue) {
      // 其他窗口广播的 bus 事件，在本窗口重放
      try {
        this.bus.emit(JSON.parse(event.newValue) as AuthEvent)
      } catch {
        // 忽略无法解析的广播
      }
    }
  }

  constructor(options: AuthOptions) {
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY
    this.busKey = `${this.storageKey}:bus`
    this.appId = options.appId ?? ''
    this.adapter = options.adapter
    this.refreshThreshold = options.refreshThreshold ?? DEFAULT_REFRESH_THRESHOLD
    this.onUnauthorized = options.onUnauthorized
    if ((options.sync ?? true) && typeof window !== 'undefined') {
      window.addEventListener('storage', this.onStorage)
    }
  }

  /** 移除 storage 监听（应用卸载时调用） */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.onStorage)
    }
    this.stateListeners.clear()
    this.bus.clear()
  }

  // -------------------------------------------------------------------------
  // 登录 / 登出
  // -------------------------------------------------------------------------

  /** 登录：调 adapter.login，持久化 token + 用户，广播 'login' */
  async login(credentials: unknown): Promise<void> {
    const result = await this.adapter.login(credentials)
    const state: AuthState = {
      token: this.toTokenBundle(result),
      user: result.user ?? null,
      permissions: [],
    }
    this.commit(state)
    this.broadcast({ type: 'login', state })
  }

  /** 登出：清空登录态，广播 'logout' */
  logout(): void {
    this.clear()
    this.broadcast({ type: 'logout', state: this.emptyState() })
  }

  // -------------------------------------------------------------------------
  // token
  // -------------------------------------------------------------------------

  /** 同步读取当前 accessToken（不做过期判断，需要有效 token 请用 getValidAccessToken） */
  getAccessToken(): string | null {
    return this.read().token?.accessToken ?? null
  }

  getRefreshToken(): string | null {
    return this.read().token?.refreshToken ?? null
  }

  isAuthenticated(): boolean {
    const { token } = this.read()
    return token !== null && token.expiresAt > Date.now()
  }

  /**
   * 获取一个有效的 accessToken：临近过期时自动用 refreshToken 续期。
   * 并发调用共享同一次刷新；刷新失败走鉴权过期流程（重新登录）。
   */
  async getValidAccessToken(): Promise<string> {
    const { token } = this.read()
    if (token && token.expiresAt - Date.now() > this.refreshThreshold) {
      return token.accessToken
    }
    return this.refreshAccessToken()
  }

  /** 通过 refreshToken 刷新 accessToken，成功后广播 'token-refreshed' */
  refreshAccessToken(): Promise<string> {
    if (this.refreshPromise) return this.refreshPromise

    const refreshToken = this.getRefreshToken()
    if (!refreshToken) {
      this.handleUnauthorized()
      return Promise.reject(new Error('no refresh token'))
    }

    this.refreshPromise = this.adapter
      .refresh(refreshToken)
      .then((result) => {
        const state: AuthState = {
          ...this.read(),
          token: this.toTokenBundle(result),
          user: result.user ?? this.read().user,
        }
        this.commit(state)
        this.broadcast({ type: 'token-refreshed', state })
        return state.token!.accessToken
      })
      .catch((error: unknown) => {
        this.handleUnauthorized()
        throw error
      })
      .finally(() => {
        this.refreshPromise = null
      })

    return this.refreshPromise
  }

  /** 鉴权过期：清空登录态、广播 'token-expired'、触发重新登录回调 */
  private handleUnauthorized(): void {
    this.clear()
    this.broadcast({ type: 'token-expired', state: this.emptyState() })
    this.onUnauthorized?.()
  }

  // -------------------------------------------------------------------------
  // 用户 / 权限
  // -------------------------------------------------------------------------

  /** 获取用户信息；force=true 时强制拉取最新并广播 'user-updated' */
  async getUserInfo(force = false): Promise<AuthUser | null> {
    const cached = this.read().user
    if (cached && !force) return cached

    const user = await this.adapter.getUserInfo()
    const state: AuthState = { ...this.read(), user }
    this.commit(state)
    this.broadcast({ type: 'user-updated', state })
    return user
  }

  getUser(): AuthUser | null {
    return this.read().user
  }

  hasRole(role: string): boolean {
    return this.getUser()?.roles.includes(role) ?? false
  }

  /** 获取当前应用的资源权限码；force=true 时强制拉取并广播 'permissions-updated' */
  async getPermissions(force = false): Promise<string[]> {
    const cached = this.read().permissions
    if (cached.length > 0 && !force) return cached

    const permissions = await this.adapter.getPermissions(this.appId)
    const state: AuthState = { ...this.read(), permissions }
    this.commit(state)
    this.broadcast({ type: 'permissions-updated', state })
    return permissions
  }

  hasPermission(code: string): boolean {
    return this.read().permissions.includes(code)
  }

  /** 生成请求头；配合 getValidAccessToken 用于请求拦截器 */
  getAuthHeaders(): Record<string, string> {
    const token = this.getAccessToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  // -------------------------------------------------------------------------
  // 订阅
  // -------------------------------------------------------------------------

  /** 订阅登录态快照变更（React store 镜像用），返回取消订阅函数 */
  subscribe(listener: AuthListener): () => void {
    this.stateListeners.add(listener)
    return () => this.stateListeners.delete(listener)
  }

  /** 订阅指定类型的 bus 事件 */
  on(type: AuthEventType, listener: BusListener): () => void {
    return this.bus.on((event) => {
      if (event.type === type) listener(event)
    })
  }

  // -------------------------------------------------------------------------
  // 内部
  // -------------------------------------------------------------------------

  private toTokenBundle(result: LoginResult): TokenBundle {
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: Date.now() + result.expiresIn * 1000,
    }
  }

  /** 写入 storage 并通知本窗口订阅方（跨窗口由 storage 事件同步） */
  private commit(state: AuthState): void {
    localStorage.setItem(this.storageKey, JSON.stringify(state))
    this.notifyState(state)
  }

  private clear(): void {
    localStorage.removeItem(this.storageKey)
    this.notifyState(this.emptyState())
  }

  private read(): AuthState {
    try {
      const raw = localStorage.getItem(this.storageKey)
      if (!raw) return this.emptyState()
      return JSON.parse(raw) as AuthState
    } catch {
      return this.emptyState()
    }
  }

  private emptyState(): AuthState {
    return { token: null, user: null, permissions: [] }
  }

  private notifyState(state: AuthState): void {
    this.stateListeners.forEach((listener) => listener(state))
  }

  /**
   * bus 广播：本窗口直接 emit；跨窗口经 busKey 写 storage 透传，
   * 其他窗口在 storage 事件里重放（storage 事件不在写入方窗口触发，不会重复）。
   */
  private broadcast(event: AuthEvent): void {
    this.bus.emit(event)
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.busKey, JSON.stringify(event))
    }
  }
}

/** 创建鉴权实例，父子应用各自调用并约定同一 storageKey 即可共享登录态 */
export function createAuth(options: AuthOptions): Auth {
  return new Auth(options)
}
