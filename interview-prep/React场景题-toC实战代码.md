# React toC 场景题实战代码（2026 大厂版）

> 定位：现有文档讲答题框架，本文档补齐「能直接写进 IDE 的生产级代码」。
> 每题按「考察点 → 完整代码 → 关键话术 → 常见追问」组织。
> 代码基于 React 18 + TypeScript，toC 场景默认考虑弱网、低端机、高并发。

---

## 1. 搜索联想：防抖 + 竞态处理 + 高亮

**考察点：** 防抖、请求竞态（旧结果覆盖新结果）、useDeferredValue、安全性（关键词高亮 XSS）。

### 1.1 完整实现

```tsx
import { useState, useEffect, useRef } from 'react';

interface Suggestion { id: string; text: string; }

// 自定义防抖 Hook —— 注意：不要在渲染函数里直接 debounce(setXxx)，
// 每次 render 都会创建新的 debounced 函数，防抖失效（面试官最常挖的坑）
function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer); // 每次输入清掉上一个定时器
  }, [value, delay]);
  return debounced;
}

async function fetchSuggestions(kw: string, signal: AbortSignal): Promise<Suggestion[]> {
  const res = await fetch(`/api/suggest?q=${encodeURIComponent(kw)}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function SearchBox() {
  const [keyword, setKeyword] = useState('');
  const debouncedKw = useDebouncedValue(keyword, 300);
  const [list, setList] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  // 请求序号兜底：即使 AbortController 不可用（如旧浏览器/某些 polyfill），
  // 也能保证「最后一次发起的请求胜出」
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!debouncedKw.trim()) { setList([]); return; }

    const controller = new AbortController();
    const reqId = ++reqIdRef.current;
    setLoading(true);

    fetchSuggestions(debouncedKw, controller.signal)
      .then(data => {
        if (reqId !== reqIdRef.current) return; // 已有更新的请求，丢弃旧结果
        setList(data);
      })
      .catch(err => {
        if (err.name !== 'AbortError') console.error(err); // AbortError 是正常取消
      })
      .finally(() => {
        if (reqId === reqIdRef.current) setLoading(false);
      });

    return () => controller.abort(); // 关键词变化/组件卸载时取消在途请求
  }, [debouncedKw]);

  return (
    <div>
      <input
        value={keyword}
        onChange={e => setKeyword(e.target.value)}
        placeholder="搜索商品"
      />
      {loading && <span className="loading">搜索中…</span>}
      <ul>
        {list.map(item => (
          <li key={item.id}>
            <HighlightText text={item.text} keyword={debouncedKw} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// 关键词高亮：拆分字符串渲染 <mark>，绝不用 dangerouslySetInnerHTML
function HighlightText({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(keyword)})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === keyword.toLowerCase()
          ? <mark key={i}>{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

### 1.2 关键话术

- **双保险竞态处理**：`AbortController` 取消在途请求（省带宽），请求序号保证最后一次胜出（兜住不支持 abort 的场景）。生产环境两者都要。
- **防抖在 React 里的正确姿势**：要么用 `useDebouncedValue`，要么把 debounced 函数用 `useMemo`/`useRef` 固定下来。**直接 `onChange={debounce(fn, 300)}` 是错的**——每次 render 创建新函数，等于没防抖。
- **高亮安全**：拆分字符串 + `<mark>` 渲染，不碰 `dangerouslySetInnerHTML`，天然免疫 XSS。

### 1.3 常见追问

- **useDeferredValue 能替代防抖吗？** 不能。`useDeferredValue` 是让「渲染」延迟（输入框保持响应，结果列表滞后渲染），**不减少请求次数**；防抖是减少「请求/计算」次数。两者可叠加：防抖控制请求频率，deferred 控制渲染卡顿。
- **结果要不要缓存？** 内存级 LRU（Map + 容量上限）缓存最近 N 个关键词结果，回退输入时秒出；一般不做 localStorage 持久化（联想词时效性强）。
- **空结果/接口报错怎么设计？** 空结果给「猜你喜欢」兜底而不是空白；报错静默降级为不展示联想，不打断输入。

---

## 2. 无限滚动：IntersectionObserver + 防重 + 竞态

**考察点：** 视口感知、分页状态机、重复触发、快速翻页竞态。

### 2.1 完整实现

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';

interface Item { id: string; title: string; }
interface PageData { list: Item[]; nextCursor: string | null; }

async function fetchPage(cursor: string | null, signal: AbortSignal): Promise<PageData> {
  const url = cursor ? `/api/feed?cursor=${cursor}` : '/api/feed';
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function InfiniteFeed() {
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  // loading 用 ref 同步一份：IntersectionObserver 回调里拿到的是闭包旧值
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return; // 防重：在途请求直接忽略
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // 这里用函数式 setState 拿最新 cursor，避免闭包陷阱
      const data = await fetchPage(cursor, new AbortController().signal);
      setItems(prev => {
        // 去重：弱网重试可能导致同一批数据重复返回
        const existIds = new Set(prev.map(i => i.id));
        return [...prev, ...data.list.filter(i => !existIds.has(i.id))];
      });
      setCursor(data.nextCursor);
      setHasMore(data.nextCursor !== null);
    } catch (e) {
      setError('加载失败，点击重试');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [cursor, hasMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '200px' } // 提前 200px 触发，用户感知不到加载
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div>
      {items.map(item => <FeedCard key={item.id} item={item} />)}
      {hasMore && (
        <div ref={sentinelRef} className="sentinel">
          {loading ? '加载中…' : error
            ? <button onClick={loadMore}>{error}</button>
            : ''}
        </div>
      )}
      {!hasMore && <div className="end">到底啦</div>}
    </div>
  );
}
```

### 2.2 关键话术

- **为什么用 IntersectionObserver 而不是 scroll 监听**：scroll 事件高频触发需要节流、且每次都要 `getBoundingClientRect` 强制同步布局；IO 由浏览器在合成线程异步通知，不阻塞主线程，`rootMargin` 还能做预加载。
- **防重三层**：`loading` 状态 + `loadingRef`（闭包旧值问题）+ 数据 id 去重（弱网重试）。
- **游标分页优于 offset 分页**：feed 流数据实时变化，offset 会漏数据/重复；cursor 基于锚点，天然稳定。

### 2.3 常见追问

- **数据量到几千条后滚动变卡？** 上虚拟列表（react-window / TanStack Virtual），只渲染可视区 + overscan；不定高场景用动态测量 + 高度缓存。代价：Ctrl+F 找不到屏外内容、部分读屏器受影响。
- **返回上一页要还原滚动位置和数据？** 数据缓存交给 TanStack Query（或自维护 cache），滚动位置在卸载前记录 `scrollY`，回来恢复；Vue 里是 keep-alive，React 没有官方等价物，需要自实现或 React Router 的 `ScrollRestoration`（数据路由）。

---

## 3. 输入卡顿：状态下沉 + memo + useTransition

**考察点：** 重新渲染的归因、状态放置位置、并发渲染。

### 3.1 错误示范 → 正确写法

```tsx
// ❌ 常见错误：输入框状态放顶层，每敲一个字全树重渲染
function BadPage() {
  const [kw, setKw] = useState('');
  return (
    <>
      <input value={kw} onChange={e => setKw(e.target.value)} />
      <HugeChartWall />   {/* 100 个图表跟着重渲染 */}
      <ExpensiveList kw={kw} />
    </>
  );
}

// ✅ 手段一：状态下沉（colocation）——改动 render 的位置，而不是数量
function GoodPage() {
  return (
    <>
      <SearchInput />     {/* kw 状态收在自己内部 */}
      <HugeChartWall />   {/* 不再受输入影响 */}
    </>
  );
}

// ✅ 手段二：紧急/非紧急更新分离 —— useTransition
import { useState, useTransition, memo } from 'react';

const ListItem = memo(function ListItem({ text }: { text: string }) {
  return <div className="row">{text}</div>;
});

function SearchWithTransition({ data }: { data: string[] }) {
  const [input, setInput] = useState('');
  const [filtered, setFiltered] = useState<string[]>(data);
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setInput(v); // 紧急：输入框立即回显
    startTransition(() => {
      // 非紧急：1 万条过滤 + 列表重渲染，可被新的输入打断
      setFiltered(data.filter(d => d.includes(v)));
    });
  }

  return (
    <>
      <input value={input} onChange={handleChange} />
      {isPending && <span className="pending">筛选中…</span>}
      {filtered.map(t => <ListItem key={t} text={t} />)}
    </>
  );
}
```

### 3.2 关键话术

- **优化顺序的优先级**：先 Profiler 定位 → 状态下沉（零成本，收益最大）→ 拆分组件 → memo/useMemo/useCallback（最后才上，它们本身有内存和比较成本）。「memo 加了没用」十有八九是传了内联对象/函数，引用每次都变。
- **useTransition 的本质**：不是「让 React 变异步」，而是给更新标记优先级（TransitionLane），让输入这类 SyncLane 更新能打断它。**它不减少计算量，只让计算可中断、不阻塞输入。**

### 3.3 常见追问

- **useTransition vs useDeferredValue 怎么选？** 能控制 setState 的地方用 useTransition（包 setter）；值是从 props/上游来的、控制不了 setter，用 useDeferredValue（包 value）。
- **transition 里的旧 UI 会怎么样？** 渲染期间 React 继续展示旧 UI，新 UI 准备好后一次性提交，不会出现「半新半旧」。

---

## 4. 首屏白屏：路由分包 + 骨架屏 + 预加载

**考察点：** 代码分割策略、Suspense、加载体验设计。

```tsx
import { lazy, Suspense } from 'react';
import { Routes, Route, Link } from 'react-router-dom';

// 路由级分包：首屏只下载当前路由的 chunk
const Home = lazy(() => import('./pages/Home'));
const Detail = lazy(() => import(
  /* webpackChunkName: "detail" */
  /* webpackPrefetch: true */   // 首屏空闲时预取，跳转秒开
  './pages/Detail'
));
// 重组件按需：图表库/编辑器这种几百 KB 的，不进主包
const ChartModal = lazy(() => import('./components/ChartModal'));

// 骨架屏：比 spinner 更能稳住 CLS，也给用户「结构已就位」的心理预期
function PageSkeleton() {
  return (
    <div className="skeleton">
      <div className="sk-banner" />
      <div className="sk-row" />
      <div className="sk-row" />
      <div className="sk-row" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/detail/:id" element={<Detail />} />
      </Routes>
    </Suspense>
  );
}
```

**关键话术：**

- **分包优先级**：先路由级（收益最大），再重组件（图表/编辑器/弹窗），最后 vendor 拆分（react、图表库各自独立 chunk 吃浏览器缓存）。
- **预加载策略**：`webpackPrefetch`（浏览器空闲时拉取，适合大概率会去的页面）vs `webpackPreload`（和主包并行，适合首屏必需）；mouseover 触发动态 import 做「hover 预加载」是进一步的体感优化。
- **骨架屏的意义**：主要稳 **CLS**（布局偏移）和体感，不直接提升 LCP；LCP 要靠 CDN、图片优化、`fetchpriority="high"` 给首屏大图。
- **追问「白屏时间怎么量化」**：Performance 面板本地看 FP/FCP/LCP；线上用 `PerformanceObserver` 采 LCP/INP 上报（INP 已于 2024 年 3 月替代 FID 成为 Core Web Vitals）。

---

## 5. 防重复提交：下单按钮连点

**考察点：** 交互幂等、请求幂等、锁的正确释放。

```tsx
import { useRef, useState } from 'react';

function OrderButton({ orderId }: { orderId: string }) {
  const [submitting, setSubmitting] = useState(false);
  const lockRef = useRef(false); // ref 同步生效，state 异步——竞态窗口内 state 不可靠

  async function handleSubmit() {
    if (lockRef.current) return;   // 第一层：前端锁，挡住连点
    lockRef.current = true;
    setSubmitting(true);

    try {
      await fetch('/api/order/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          // 第二层：幂等键。弱网重试、双击、刷新重提都靠它去重
          idempotencyKey: crypto.randomUUID(),
        }),
      });
    } catch {
      lockRef.current = false;     // 失败要释放锁，允许重试
      setSubmitting(false);
      return;
    }
    // 成功后跳转到结果页，不释放锁（页面即将销毁）
    location.href = `/order/result/${orderId}`;
  }

  return (
    <button disabled={submitting} onClick={handleSubmit}>
      {submitting ? '提交中…' : '提交订单'}
    </button>
  );
}
```

**关键话术：**

- **为什么用 ref 而不是 state 做锁**：`setState` 是异步批处理的，两次快速点击可能在同一次渲染周期内都读到 `submitting === false`；`ref.current` 赋值同步生效，没有竞态窗口。
- **前端锁只是体验层**，真正的幂等必须靠服务端：`idempotencyKey`（客户端生成 UUID，服务端去重表）或订单号唯一约束。面试里只说 `disabled` 是减分项——弱网下请求可能已发出但响应丢失，用户重试就重复下单了。
- **失败释放锁，成功不释放**：成功后页面要跳转，释放锁反而留出再点一次的窗口。

---

## 6. 401 登录态失效：统一刷新 + 请求重放

**考察点：** 请求层架构、并发下只刷一次 token（单飞）、失败重放。

```ts
// request.ts —— 全局请求封装
let refreshing: Promise<string> | null = null; // 单飞：并发 401 只刷一次

async function refreshToken(): Promise<string> {
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include', // refresh token 走 HttpOnly Cookie，前端不碰
  });
  if (!res.ok) throw new Error('refresh failed');
  const { accessToken } = await res.json();
  localStorage.setItem('access_token', accessToken);
  return accessToken;
}

export async function request<T>(url: string, options: RequestInit = {}, retried = false): Promise<T> {
  const token = localStorage.getItem('access_token');
  const res = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 && !retried) {
    try {
      // 并发多个请求同时 401：共享同一个 refreshing Promise，只刷一次
      refreshing ??= refreshToken().finally(() => { refreshing = null; });
      await refreshing;
      return request<T>(url, options, true); // 重放原请求，只重试一次
    } catch {
      // 刷新也失败 → 登录态彻底失效，跳登录页并记录回跳地址
      location.href = `/login?redirect=${encodeURIComponent(location.pathname)}`;
      throw new Error('unauthorized');
    }
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

**关键话术：**

- **单飞模式（single-flight）**：`refreshing ??=` 保证并发 401 共享一次刷新，避免 N 个请求触发 N 次刷新（服务端可能因此作废旧 refresh token，全军覆没）。
- **refresh token 放 HttpOnly Cookie**：前端 JS 读不到，免疫 XSS 窃取；access token 放内存/localStorage，短时效。
- **重放只重试一次**（`retried` 标志），防止刷新成功但业务接口仍 401 时死循环。
- **追问「为什么不直接用拦截器库」**：思路一样，axios interceptor / TanStack Query 的 `retry` + 自定义 fetcher 都是这个模型的封装；面试官想听的是并发竞态和失败兜底，不是 API。

---

## 7. 局部崩溃兜底：Error Boundary

**考察点：** 错误隔离、为什么 try/catch 包不住渲染错误。

```tsx
import { Component, type ReactNode } from 'react';

// Error Boundary 目前只能用 class 组件写（React 19 仍未提供 Hook 版）
class ErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true }; // 渲染期错误 → 触发降级 UI
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 上报监控：componentStack 定位到具体组件
    reportError({ message: error.message, stack: info.componentStack });
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// 用法：按业务模块包，一个模块崩了不影响整页
function FeedPage() {
  return (
    <div>
      <ErrorBoundary fallback={<div className="fallback">推荐流加载失败，刷新试试</div>}>
        <RecommendFeed />
      </ErrorBoundary>
      <ErrorBoundary fallback={<div className="fallback">广告位异常</div>}>
        <AdBanner />
      </ErrorBoundary>
    </div>
  );
}
```

**关键话术：**

- **try/catch 为什么不行**：`return <Child />` 只是创建 React Element，Child 的渲染发生在 React 调度阶段，不在当前同步调用栈里，catch 不到。
- **Error Boundary 抓什么、不抓什么**：抓「渲染期 + 生命周期 + 构造函数」的错误；**不抓**事件回调（用 try/catch）、异步代码（setTimeout/Promise 里用 catch）、SSR 错误。
- **粒度设计**：全局一个兜底 + 核心模块各自包，避免局部异常白屏整页——toC 场景广告位崩了不该影响下单链路。

---

## 附：答题节奏模板

1. **先确认边界**：数据量级？弱网占比？设备档位？
2. **分层给方案**：网络层 / 渲染层 / 状态层 / 交互层。
3. **每个手段说代价**：虚拟列表 → 屏外内容不可搜索；memo → 比较成本 + 内存；防抖 → 结果延迟 300ms。
4. **落到监控**：PerformanceObserver 采 LCP/INP/LongTask 上报，「先测量再优化」是高级岗和中级岗的分水岭。
