# SSE 流式处理与 AI 前端专题

> 2026 大厂面试新增独立考点模块，字节/腾讯/阿里/美团必问。
> 与理想同事 Agent App 项目直接关联，是差异化优势点。
> 核心考察：不只是"会用 EventSource"，而是**三层架构 + 兜底策略**的工程化能力。

---

## 一、SSE vs WebSocket 选型（开场必问）

> 面试官："SSE 和 WebSocket 有什么区别？AI 对话场景为什么选 SSE 不选 WebSocket？"

| 维度 | SSE | WebSocket | AI 场景选型理由 |
|---|---|---|---|
| 通信方向 | 单向（服务器 → 客户端） | 双向 | AI 生成是单向流，服务器推送即可 |
| 协议 | 基于 HTTP（兼容性好） | 独立协议（WS/WSS） | 无需协议升级，穿透防火墙/代理更容易 |
| 自动重连 | 浏览器内置支持 | 需手动实现 | SSE 断线自动重连，体验好 |
| 消息格式 | 文本（UTF-8） | 文本/二进制 | AI 输出就是文本流 |
| 连接数限制 | 浏览器同域名 6 个 | 无限制 | AI 对话通常只需一个连接 |
| 实现复杂度 | 简单 | 复杂 | 快速开发，减少 bug |
| 自定义 Header | ❌ 原生 EventSource 不支持 | ✅ 支持 | 需要鉴权时用 Fetch+ReadableStream 替代 |

**一句话回答：** AI 对话是"用户问一句、服务器流式推一段"的单向场景，SSE 基于 HTTP 天然匹配、自动重连、实现简单。WebSocket 的双向能力在 AI 对话中用不上，反而增加复杂度。需要双向实时交互（协同编辑、实时游戏）才选 WebSocket。

**追问：原生 EventSource 的局限是什么？**

```
1. 不支持 POST 请求（只能 GET）
2. 不支持自定义 Header（无法带 Authorization token）
3. 不支持自定义超时
4. 浏览器同域名 6 连接限制

→ 解决方案：用 Fetch + ReadableStream 替代原生 EventSource
```

---

## 二、Fetch + ReadableStream 实现 SSE（核心手写题）

> 面试官："Fetch + ReadableStream 如何实现 SSE 流式输出？"

```typescript
async function streamChat(
  url: string,
  body: object,
  onChunk: (text: string) => void,
  signal?: AbortSignal
) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,  // 原生 EventSource 做不到
    },
    body: JSON.stringify(body),
    signal,  // 关联 AbortController，支持中断
  })

  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''  // 粘包/半包缓冲区

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    // 解码并追加到缓冲区
    buffer += decoder.decode(value, { stream: true })

    // 按 SSE 协议的分隔符 \n\n 切分完整消息
    const lines = buffer.split('\n\n')
    // 最后一个元素可能是不完整的 chunk，留到下次拼接
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') return  // 流结束标记
        try {
          const parsed = JSON.parse(data)
          onChunk(parsed.choices?.[0]?.delta?.content || '')
        } catch {
          // JSON 不完整，可能是半包，忽略或缓存
        }
      }
    }
  }
}
```

---

## 三、粘包与半包处理（腾讯/字节/美团必问）

> 面试官："如何处理流式数据中的粘包和半包问题？"

### 什么是粘包/半包

```
粘包：多个完整消息在一次 read() 中返回
  收到的 chunk: "data: {\"text\":\"你好\"}\n\ndata: {\"text\":\"世界\"}\n\n"
  → 一次 read 拿到两条消息，需要拆分

半包：一条消息被拆到两次 read() 中
  第一次 read: "data: {\"text\":\"你"
  第二次 read: "好\"}\n\n"
  → 需要缓存不完整部分，等下一次拼接
```

### 解决方案：buffer 拼接

```
核心思路：维护一个字符串 buffer

1. 每次 read() 返回的 Uint8Array 解码后追加到 buffer
2. 按协议分隔符（SSE 是 \n\n）切分
3. 切分后最后一个元素可能不完整 → 留在 buffer 等下次
4. 完整的消息逐条处理

关键代码（上面 streamChat 中的核心逻辑）：
  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split('\n\n')
  buffer = lines.pop() || ''  // 不完整的留在 buffer
```

**⚠️ 注意 `decoder.decode(value, { stream: true })` 的 `stream: true`**：
- 多字节 UTF-8 字符（如中文 3 字节）可能跨 chunk 边界
- `stream: true` 让 decoder 保留未完成的多字节序列，下次继续解码
- 不加的话中文可能出现乱码

---

## 四、中断与清理（AbortController）

> 面试官："用户点击'停止生成'，前端如何从网络层到 UI 层彻底中断？"

```typescript
const controller = new AbortController()

// 发起请求时传入 signal
streamChat('/api/chat', { message }, onChunk, controller.signal)

// 用户点击停止
function handleStop() {
  // 1. 中断网络请求（Fetch 会 reject AbortError）
  controller.abort()

  // 2. 清理 UI 状态
  setLoading(false)
  setStreaming(false)

  // 3. 清理定时器/动画
  if (typewriterTimer) clearInterval(typewriterTimer)

  // 4. 标记消息为"已中断"状态
  updateLastMessage({ status: 'aborted' })
}

// 组件卸载时也要中断
onUnmounted(() => {
  controller.abort()
})
```

**常见坑（追问点）：**
- abort 后 `reader.read()` 会 reject `AbortError`，需要 catch 并区分是用户主动取消还是网络错误
- abort 后 loading 状态、打字机动画、光标闪烁都要清理干净
- Vue 中用 `onWatcherCleanup` / React 中用 `useEffect` cleanup 确保组件卸载时中断

---

## 五、断线重连 + 消息去重（字节/腾讯高频）

> 面试官："请设计一个支持断线重连 + 消息去重的 SSE 客户端"

### 断线重连 + 指数退避

```typescript
class SSEClient {
  private retryCount = 0
  private maxRetries = 5
  private baseDelay = 1000  // 1s 起步
  private lastEventId: string | null = null
  private controller: AbortController | null = null

  async connect(url: string, body: object) {
    while (this.retryCount <= this.maxRetries) {
      try {
        this.controller = new AbortController()
        await this.stream(url, body)
        this.retryCount = 0  // 成功后重置
        return
      } catch (err) {
        if (err.name === 'AbortError') return  // 用户主动中断，不重连

        this.retryCount++
        if (this.retryCount > this.maxRetries) {
          this.onError(new Error('重连次数用尽'))
          return
        }

        // 指数退避：1s → 2s → 4s → 8s → 16s，加随机抖动防惊群
        const delay = this.baseDelay * Math.pow(2, this.retryCount - 1)
          + Math.random() * 1000
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }

  private async stream(url: string, body: object) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    // 断线续接：带上 last-event-id，服务器从断点继续推送
    if (this.lastEventId) {
      headers['Last-Event-ID'] = this.lastEventId
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: this.controller!.signal,
    })

    // ... 读取流，每条消息处理时记录 this.lastEventId = event.id
  }
}
```

### 为什么要指数退避？

```
固定间隔重连的问题：
  服务器刚恢复时，所有客户端同时重连 → 惊群效应 → 再次打挂

指数退避 + 随机抖动：
  1s → 2s → 4s → 8s → 16s（每次翻倍）
  + Math.random() * 1000（加随机抖动，错开重连时间）
  
好处：
  给服务器恢复时间
  避免客户端集中重连
  减少无效请求
```

### 消息去重

```
方案一：last-event-id（SSE 协议原生支持）
  服务器每条消息带 id 字段：id: msg-123
  客户端记录最后收到的 id
  重连时通过 Last-Event-ID header 告诉服务器
  服务器从该 id 之后继续推送

方案二：客户端 Set 去重
  维护一个 processedIds: Set<string>
  收到消息先判断 id 是否已处理过
  防止服务器重发导致的重复渲染

方案三：序号机制
  每条消息带自增 seq
  客户端记录 lastSeq
  重连后丢弃 seq <= lastSeq 的消息
```

---

## 六、流式 Markdown 增量渲染（阿里/腾讯/百度）

> 面试官："如何在前端实现流式 Markdown 解析器？如何避免代码块/标签截断？"

### 核心问题

```
AI 逐字输出 Markdown，用户看到的效果：
  第1帧：# 标
  第2帧：# 标题
  第3帧：# 标题\n\n这是一段**粗
  第4帧：# 标题\n\n这是一段**粗体**文字

问题：
  1. 第3帧的 **粗 是不完整的 Markdown 语法 → 渲染异常/闪烁
  2. 代码块 ```js 可能被截断 → 高亮渲染错误
  3. 表格是成块结构，必须等完整才能渲染
  4. 每个 chunk 都重新解析整个 Markdown → 性能差
```

### 解决方案

```
策略一：延迟闭合（推荐）
  收到不完整语法时，先在末尾补全再渲染
  例如收到 **粗 → 临时补全为 **粗** 渲染
  下一次 chunk 到来时替换临时补全
  
  代码块同理：收到 ```js\nconst x  → 临时补全 ```js\nconst x\n```
  
  实现：检查未闭合的 Markdown 标记，在渲染前自动闭合

策略二：行级增量渲染
  按行切分流式内容
  只有遇到 \n 才认为一行完整，送入 Markdown 解析器
  表格等特殊块：等整个块完整（检测到闭合行）再一次渲染

策略三：Web Worker 解析
  Markdown 解析（尤其是带数学公式的 KaTeX）耗时
  放到 Web Worker 中执行，不阻塞主线程
  解析完成后 postMessage 回主线程更新 DOM
```

### 打字机效果性能优化

> 面试官："AI 流式输出时，前端如何解决打字机效果带来的频繁 DOM 渲染？"

```
问题：每个 token/chunk 都触发一次 DOM 更新 → 频繁重渲染 → 掉帧

解决方案：

1. requestAnimationFrame 批量更新（核心）
   不要在 onChunk 回调里直接更新 DOM
   把新内容追加到缓冲区
   用 requestAnimationFrame 每帧批量更新一次
   
   let pendingText = ''
   let rafId: number | null = null
   
   function onChunk(text: string) {
     pendingText += text
     if (!rafId) {
       rafId = requestAnimationFrame(() => {
         messageElement.textContent += pendingText
         pendingText = ''
         rafId = null
       })
     }
   }

2. 节流渲染
   每 50ms 最多更新一次 DOM
   中间到达的 chunk 全部缓存

3. 虚拟列表（超长对话）
   对话历史超过 100 条时
   用虚拟列表只渲染可视区域的消息
   流式更新的消息始终固定在底部

4. React 场景：useTransition / useDeferredValue
   把流式文本更新标记为非紧急更新
   保证输入框等关键交互始终响应
```

---

## 七、三层架构总结（面试话术）

> 面试官："对接大模型 API 时，前端怎么设计流式方案？"

```
"我会按三层架构来设计：

请求层：
  用 Fetch + ReadableStream 替代原生 EventSource，
  因为原生不支持 POST 和自定义 Header 鉴权。
  配合 AbortController 实现用户主动中断。

解析层：
  维护 buffer 按 \n\n 分隔符拼接残缺 chunk，处理粘包半包。
  TextDecoder 加 stream: true 防止中文乱码。
  遇到 [DONE] 标记正常结束，[ERROR] 标记触发错误回调。

渲染层：
  逐字上屏用 requestAnimationFrame 控制帧率避免掉帧。
  Markdown 边输出边解析时，对未闭合语法做延迟闭合处理。
  超长对话用虚拟列表只渲染可视区域。

兜底策略：
  断线自动重连 + 指数退避 + last-event-id 续接。
  消息用 Set 去重防重复渲染。
  组件卸载时 AbortController 中断请求并清理所有定时器。"
```

---

## 八、与理想同事 Agent App 的结合话术

```
"在理想同事 Agent App 中，我负责了 AI 对话的流式输出方案。
 当时面临的核心挑战是：模型推理需要 5-10 秒，如果等全部生成完再展示，
 用户会觉得'卡死了'。

 我们选择了 SSE 方案，用 Fetch + ReadableStream 接收流式数据，
 首字响应时间控制在 500ms 以内。

 具体实现上：
 - 请求层封装了统一的流式请求模块，支持鉴权和中断
 - 解析层处理了粘包半包和中文乱码问题
 - 渲染层用 requestAnimationFrame 批量更新，避免每个 token 都触发重渲染
 - 中断方面用 AbortController 实现'停止生成'，同时清理所有状态

 这个方案让用户体验从'等 10 秒看结果'变成'500ms 看到第一个字，
 后续内容逐字流出'，感知等待时间大幅降低。"
```

---

## 九、高频追问速查

| 问题 | 一句话答案 |
|---|---|
| SSE 和 WebSocket 区别？ | SSE 单向/HTTP/自动重连/简单；WS 双向/独立协议/手动重连/复杂 |
| 为什么 AI 对话用 SSE？ | 单向推送场景匹配、HTTP 兼容性好、自动重连、实现简单 |
| EventSource 局限？ | 不支持 POST、不支持自定义 Header → 用 Fetch+ReadableStream |
| 粘包半包怎么处理？ | 维护 buffer，按 \n\n 切分，不完整的留到下次拼接 |
| 怎么中断流式请求？ | AbortController.abort()，同时清理 UI 状态和定时器 |
| 断线重连怎么做？ | 指数退避 + 随机抖动 + last-event-id 续接 + 消息去重 |
| 流式 Markdown 闪烁？ | 未闭合语法延迟闭合；行级增量渲染；Web Worker 解析 |
| 打字机效果卡顿？ | requestAnimationFrame 批量更新 + 节流渲染 + 虚拟列表 |
| 长对话列表优化？ | 虚拟列表只渲染可视区域 + overscan 缓冲 |
| AI 输出太慢前端能做什么？ | 首字时间优化（DNS预解析/HTTP3/预连接）+ 骨架屏 + 流式渲染 + 可取消机制 |

---

## 附录：大厂真实深挖题与标准答案（2026 面经归档）

> 来源：德德收集的真实二面/三面追问题，以下为完整答案。

### A1. 怎么判断 SSE 服务端断开？监听哪个事件？

三层回答：
1. **正常结束**：fetch 版 `reader.read()` 返回 `done: true`；或服务端约定标记（`data: [DONE]`）。EventSource 版服务端断流触发 **`onerror`**，`readyState` → CONNECTING（自动重连中）/ CLOSED
2. **异常断开**：fetch promise reject / 流中途切断
3. **假死检测（关键洞察）**：**TCP 连接没断 ≠ 流是活的**（代理/NAT 静默丢连接，两端收不到 FIN）→ 必须有**应用层心跳**：服务端每 15~30s 发 `: ping`（SSE 注释行）；客户端**看门狗**计时，超过 N 秒没收到任何字节（含心跳）→ 主动 abort + 重连

断点续传：EventSource 靠 `id:` 字段 + 重连自动带 `Last-Event-ID` 头；fetch 版手动：指数退避（1s→2s→4s 封顶 30s + 抖动防惊群），重连带最后事件 id / 已生成文本长度。

### A2. Markdown 分块渲染算法（为什么/怎么做/解决什么）

**为什么**：流式输出时 Markdown 不完整（围栏未闭合/表格半截），每 token 全量 re-parse 是 O(n²)；paste 一万行则一次 parse + 上万 DOM 插入直接阻塞主线程。

**拆块**：按**块级元素边界**切（空行/标题/代码块围栏/表格/列表），不按字符行切。流式场景分两类块：
- 已完成块：边界确定 → parse 一次定稿，绝不重算
- 未完成块（永远只有末尾一个）：随流增量重 parse，完成后落袋转正
- 代码块特例：围栏未闭合按纯文本渲染，闭合后才高亮（防半截闪烁）

**解决什么**：O(n²)→O(增量)；已完成块 DOM 稳定不回流不闪烁；配合 memo 组件前块全 bailout。

**一万行 paste + 滚动卡死的组合拳**：
1. 分帧渲染：rIC/rAF 每帧渲染 N 块，每帧预算 8ms
2. 虚拟列表：视口内才挂载真实 DOM，视口外预估高度占位 + 渲染后校正滚动位置
3. 语法高亮/parse 丢 Web Worker

### A3. 每块怎么缓存？缓存策略？

三层缓存：
| 层 | 做法 | 目的 |
|---|---|---|
| 解析结果缓存 | `Map<内容hash, AST/HTML>`，内容没变直接命中 | 免重复 parse |
| 组件层缓存 | 每块 `memo(Block)`，props 为块内容字符串，不变则 bailout | 免重复 render |
| 容量控制 | **LRU** 上限（如 500 块），超长会话防内存膨胀 | 内存可控 |

key = 块 index + 内容 hash：index 保证流式追加时前块 key 稳定，hash 保证内容变才重渲。

### A4. requestIdleCallback 怎么检测被 block？怎么验证不卡主线程？

```js
requestIdleCallback((deadline) => {
  while (deadline.timeRemaining() > 8 && queue.hasWork()) queue.doNext();
  if (queue.hasWork()) requestIdleCallback(/* 继续 */);
}, { timeout: 200 }); // 兜底防饿死
```

- **被 block 的信号**：`didTimeout` 频繁为 true / `timeRemaining()` ≈ 0 → 主线程繁忙
- **主动度量**：**Long Tasks API**——`PerformanceObserver` 观察 `longtask` 条目（>50ms 任务）
- **验证四步**：① Performance 面板看火焰图（长任务切成多帧碎片）；② Long Tasks 计数优化前 N 个 → 优化后 0；③ INP < 200ms / 60fps；④ **CPU 4x/6x 降频**模拟低端机复测
- 话术：rIC 是"请求"空闲，Long Tasks 是"验证"空闲——一个调度一个度量

### A5. Web Worker 通信与任务取舍

- **通信**：`postMessage` + `onmessage`，自定义协议 `{ type, requestId, payload }`，requestId 对 Promise 回调表实现 Promise 化调用
- **传参**：structured clone（对象/数组/Map/ArrayBuffer）；大数据用 **Transferable** 零拷贝转移所有权（`postMessage({buf}, [buf])`，传完主线程侧失效）
- **消息类型**（5~8 种）：init / parse / result / progress / cancel / error
- **移出的任务**：Markdown parse + 语法高亮、大列表 filter/sort、文件分片 MD5（spark-md5）、大 JSON parse、图片压缩
- **判断标准（四条件同时满足）**：纯计算无 DOM + 数据可序列化 + 耗时 > 16ms + 可异步拿结果
- **不能丢进去的**：① DOM/BOM 操作（Worker 无 document/window，硬限制）；② 需同步返回的（通信天然异步）；③ 小任务（序列化成本 > 计算本身）；④ 高频小消息（考虑 SharedArrayBuffer + Atomics，但需 COOP/COEP 跨域隔离，成本高）
