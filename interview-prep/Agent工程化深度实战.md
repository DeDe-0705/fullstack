# Agent 工程化深度实战

> 前面的 Agent 工程化专题.md 讲的是"工具使用层"——Skill/MCP/Sub-Agent。本文深入"工程实现层"——如何用 NestJS 从零搭建一个生产级 Agent 后端，前端如何与 Agent 交互，意图识别、文本切片、Loop 设计等核心能力怎么落地。基于 2026 年最新大厂实践 + 你的理想同事项目。

---

## 一、Agent 的核心：ReAct Loop

### 1.1 什么是 ReAct 模式？

ReAct = **Reason（推理）+ Act（行动）**。这是 2026 年 Agent 工程化的事实标准。

```
传统 LLM 调用（一问一答）：
  用户输入 → LLM → 输出
  ↑ 静态、无状态、不能操作外部世界

ReAct Agent（推理行动循环）：
  用户输入
    ↓
  Reason: LLM 思考"我需要做什么"
    ↓
  Act: LLM 决定调用某个工具（查数据库/搜索/发邮件）
    ↓
  Observe: 你的代码执行工具，把结果喂回 LLM
    ↓
  Reason: LLM 根据结果思考"下一步做什么"
    ↓
  ... 循环直到 LLM 认为任务完成
    ↓
  输出最终答案
```

### 1.2 为什么需要 Loop？

```
用户："帮我看下工号 001 的员工最近表现，然后给他的主管发个提醒"

没有 Loop（单轮 LLM）：
  → LLM 不知道工号 001 是谁（数据在私有数据库）
  → LLM 胡编乱造或说"我无法访问"

有 Loop（ReAct Agent）：
  Turn 1: LLM 思考 → 调用 getEmployee(001) 工具
  Turn 2: 你的代码查数据库 → 返回 { name: 'Alice', manager: 'Bob' }
  Turn 3: LLM 思考 → 调用 getPerformance('Alice') 工具
  Turn 4: 你的代码查绩效 → 返回 { rating: 4.5, trend: 'up' }
  Turn 5: LLM 思考 → 调用 sendEmail('Bob', 'Alice 表现优秀...') 工具
  Turn 6: 你的代码发邮件 → 返回 { success: true }
  Turn 7: LLM 输出最终回复："已查询 Alice 表现并通知主管 Bob"
```

---

## 二、用 NestJS 搭建 Agent 后端

### 2.1 整体架构

```
┌──────────────────────────────────────────────┐
│                 前端（Vue3/React）             │
│            SSE 流式接收 + UI 渲染              │
└──────────────────┬───────────────────────────┘
                   │ POST /api/agent/chat (SSE)
                   ▼
┌──────────────────────────────────────────────┐
│              NestJS Agent 后端                │
│                                              │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │ Controller  │  │  Agent Orchestrator   │  │
│  │  @Sse()     │→ │  (ReAct Loop 编排)    │  │
│  └─────────────┘  └──────────┬───────────┘  │
│                              │               │
│              ┌───────────────┼───────────┐  │
│              ▼               ▼           ▼  │
│  ┌──────────────┐  ┌──────────────┐ ┌─────┐ │
│  │ LLM Service  │  │ Tool Registry│ │State│ │
│  │ (Claude/GPT) │  │ (工具注册表)  │ │管理 │ │
│  └──────────────┘  └──────┬───────┘ └─────┘ │
│                            │                 │
│         ┌──────────┬───────┴────┬──────────┐ │
│         ▼          ▼            ▼          ▼ │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌───┐ │
│  │ DB Tool │ │API Tool │ │ Email    │ │...│ │
│  │(Prisma) │ │(fetch)  │ │(Nodemailer)│ │   │ │
│  └─────────┘ └─────────┘ └──────────┘ └───┘ │
└──────────────────────────────────────────────┘
```

### 2.2 核心：Agent Loop 实现

```ts
// agent.service.ts
import { Injectable } from '@nestjs/common'

@Injectable()
export class AgentService {
  constructor(
    private readonly llmService: LlmService,
    private readonly toolRegistry: ToolRegistry
  ) {}

  /**
   * ReAct Loop — Agent 的核心循环
   * 用 AsyncGenerator 实现流式输出
   */
  async *runAgent(userMessage: string, context: AgentContext): AsyncGenerator<AgentEvent> {
    const messages = [
      { role: 'system', content: this.buildSystemPrompt(context) },
      { role: 'user', content: userMessage }
    ]

    const MAX_ITERATIONS = 10  // 防止无限循环
    let iteration = 0

    while (iteration < MAX_ITERATIONS) {
      iteration++

      // 1. Reason: 调 LLM，带上可用工具定义
      yield { type: 'thinking', content: `第 ${iteration} 轮推理中...` }

      const llmResponse = await this.llmService.chat({
        messages,
        tools: this.toolRegistry.getToolDefinitions()
      })

      // 2. 判断：LLM 是要调工具，还是直接回复？
      if (llmResponse.tool_calls?.length > 0) {
        // 3. Act: LLM 决定调用工具
        for (const toolCall of llmResponse.tool_calls) {
          yield { type: 'tool_call', tool: toolCall.name, args: toolCall.args }

          // 执行工具
          const toolResult = await this.toolRegistry.execute(
            toolCall.name,
            toolCall.args,
            context
          )

          yield { type: 'tool_result', tool: toolCall.name, result: toolResult }

          // 4. Observe: 把工具结果喂回 messages
          messages.push({ role: 'assistant', content: null, tool_calls: [toolCall] })
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(toolResult) })
        }
        // 继续循环，让 LLM 根据工具结果决定下一步
      } else {
        // LLM 认为任务完成，输出最终答案
        yield { type: 'token', content: llmResponse.content }
        yield { type: 'done', content: llmResponse.content }
        return  // 退出循环
      }
    }

    // 超过最大迭代次数
    yield { type: 'error', content: 'Agent 达到最大迭代次数' }
  }

  private buildSystemPrompt(context: AgentContext): string {
    return `你是理想同事的 AI 助手。
当前用户：${context.userName}（工号 ${context.userId}）
当前页面：${context.currentPage}
你可以调用以下工具来帮助用户完成任务。`
  }
}
```

### 2.3 Controller — SSE 流式接口

```ts
// agent.controller.ts
import { Controller, Post, Body, Sse } from '@nestjs/common'
import { Observable } from 'rxjs'

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  @Sse()  // NestJS 原生 SSE 装饰器
  chat(@Body() body: { message: string; context: AgentContext }): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          // 消费 AsyncGenerator，转成 SSE 事件
          for await (const event of this.agentService.runAgent(body.message, body.context)) {
            subscriber.next({
              data: JSON.stringify(event)
            } as MessageEvent)
          }
        } catch (err) {
          subscriber.next({
            data: JSON.stringify({ type: 'error', content: err.message })
          } as MessageEvent)
        } finally {
          subscriber.complete()
        }
      })()
    })
  }
}
```

### 2.4 Tool Registry — 工具注册表

```ts
// tool.registry.ts
import { Injectable } from '@nestjs/common'

@Injectable()
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()

  register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool)
  }

  // 返回给 LLM 的工具描述（Function Calling 格式）
  getToolDefinitions() {
    return Array.from(this.tools.values()).map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters  // JSON Schema
      }
    }))
  }

  async execute(name: string, args: any, context: AgentContext) {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`未知工具：${name}`)
    return tool.handler(args, context)
  }
}

// 在 Module 中注册工具
@Module({
  providers: [
    ToolRegistry,
    {
      provide: 'TOOLS',
      useFactory: (db, email, search) => {
        return [
          {
            name: 'getEmployee',
            description: '根据工号查询员工信息',
            parameters: {
              type: 'object',
              properties: {
                employeeId: { type: 'string', description: '员工工号' }
              },
              required: ['employeeId']
            },
            handler: async (args) => {
              return db.employee.findUnique({ where: { id: args.employeeId } })
            }
          },
          {
            name: 'sendEmail',
            description: '发送邮件通知',
            parameters: {
              type: 'object',
              properties: {
                to: { type: 'string' },
                subject: { type: 'string' },
                body: { type: 'string' }
              },
              required: ['to', 'subject', 'body']
            },
            handler: async (args) => {
              return emailService.send(args)
            }
          }
        ]
      },
      inject: [PrismaService, EmailService, SearchService]
    }
  ]
})
export class AgentModule {}
```

---

## 三、前端与 Agent 交互

### 3.1 SSE 流式接收（结合你的理想同事项目）

```ts
// useAgent.ts — Vue3 Composable
import { ref } from 'vue'

export function useAgent() {
  const messages = ref<AgentMessage[]>([])
  const isThinking = ref(false)
  const currentThinking = ref('')
  let abortController: AbortController | null = null

  async function send(userInput: string, context: AgentContext) {
    // 添加用户消息
    messages.value.push({ role: 'user', content: userInput })

    // 准备接收 Agent 回复
    const assistantMsg = ref({ role: 'assistant', content: '', toolCalls: [] })
    messages.value.push(assistantMsg.value)

    isThinking.value = true
    abortController = new AbortController()

    try {
      // 注意：SSE 用 POST + fetch readable stream（不能用 EventSource，因为只支持 GET）
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userInput, context }),
        signal: abortController.signal
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      // 解析 SSE 事件流
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE 格式：data: {...}\n\n
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''  // 最后一个可能不完整

        for (const eventStr of events) {
          if (!eventStr.startsWith('data: ')) continue
          const event = JSON.parse(eventStr.slice(6))

          switch (event.type) {
            case 'thinking':
              currentThinking.value = event.content
              break

            case 'tool_call':
              assistantMsg.value.toolCalls.push({
                name: event.tool,
                args: event.args,
                status: 'running'
              })
              currentThinking.value = `正在调用 ${event.tool}...`
              break

            case 'tool_result':
              const lastCall = assistantMsg.value.toolCalls[assistantMsg.value.toolCalls.length - 1]
              if (lastCall) {
                lastCall.status = 'done'
                lastCall.result = event.result
              }
              break

            case 'token':
              assistantMsg.value.content += event.content
              currentThinking.value = ''
              break

            case 'done':
              isThinking.value = false
              currentThinking.value = ''
              break

            case 'error':
              isThinking.value = false
              assistantMsg.value.content = `⚠️ ${event.content}`
              break
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Agent 通信失败', e)
      }
    } finally {
      isThinking.value = false
    }
  }

  function abort() {
    abortController?.abort()
  }

  return { messages, isThinking, currentThinking, send, abort }
}
```

### 3.2 UI 渲染 — 展示 Agent 的"思考过程"

```vue
<template>
  <div class="chat-container">
    <!-- 消息列表 -->
    <div v-for="msg in messages" :key="msg.id" class="message">
      <!-- 用户消息 -->
      <div v-if="msg.role === 'user'" class="user-msg">{{ msg.content }}</div>

      <!-- Agent 消息 -->
      <div v-else class="agent-msg">
        <!-- 工具调用过程（展示 Agent 在干什么） -->
        <div v-for="call in msg.toolCalls" :key="call.name" class="tool-call">
          <span v-if="call.status === 'running'">🔄 调用 {{ call.name }}...</span>
          <span v-else>✅ {{ call.name }} 完成</span>
        </div>

        <!-- Agent 回复内容（流式输出） -->
        <div class="content">{{ msg.content }}</div>
      </div>
    </div>

    <!-- 思考状态 -->
    <div v-if="isThinking" class="thinking">
      <span class="dot"></span>{{ currentThinking || '思考中...' }}
    </div>

    <!-- 输入框 -->
    <div class="input-area">
      <input v-model="input" @keyup.enter="handleSend" placeholder="问点什么..." />
      <button @click="handleSend">发送</button>
      <button @click="abort" v-if="isThinking">停止</button>
    </div>
  </div>
</template>
```

### 3.3 流式渲染工程细节 — 性能与体验（大厂二面高频）

**面试场景：** "你的打字机效果怎么做？高频 setState 不会卡吗？长文本怎么办？"

#### 问题1：高频更新导致回流

```ts
// ❌ 每个 token 都 setState → 60fps 根本达不到
reader.on('token', (token) => {
  content.value += token  // 触发响应式更新 → DOM 重绘
})

// ✅ 用 requestAnimationFrame 批量更新
let buffer = ''
let rafScheduled = false

reader.on('token', (token) => {
  buffer += token
  if (!rafScheduled) {
    rafScheduled = true
    requestAnimationFrame(() => {
      content.value += buffer
      buffer = ''
      rafScheduled = false
    })
  }
})
```

#### 问题2：长文本渲染卡顿

```ts
// ❌ 10 万字 Markdown 全量重新解析 → 卡死
watch(content, () => {
  html.value = marked.parse(content.value)  // 每次都全量解析
})

// ✅ 增量渲染 + 虚拟滚动
// 1. 只解析最新的一段
// 2. 已渲染的段落不再重新解析
// 3. 超长对话用虚拟列表只渲染可视区域

const renderedParagraphs = ref<string[]>([])
watch(content, (newContent) => {
  const paragraphs = newContent.split('\n\n')
  // 只渲染新增的段落
  for (let i = renderedParagraphs.value.length; i < paragraphs.length; i++) {
    renderedParagraphs.value.push(marked.parse(paragraphs[i]))
  }
})
```

#### 问题3：自动滚动到底部

```ts
// ❌ 每次 token 都滚动 → 用户想往上翻看历史时被强制拉回底部
const el = document.querySelector('.chat-container')
el.scrollTop = el.scrollHeight  // 每次都拉

// ✅ 只在用户已经接近底部时才自动滚
function isNearBottom(el: HTMLElement, threshold = 100): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
}

watch(content, () => {
  const container = chatContainer.value
  if (isNearBottom(container)) {
    nextTick(() => {
      container.scrollTop = container.scrollHeight
    })
  }
})
```

#### 问题4：流式 Markdown 实时渲染

```ts
// 难点：流式输出时 Markdown 不完整
// "```js\nconst a = 1"  ← 代码块没闭合，marked 会渲染错

// 方案1：等段落完整再渲染（双换行为段落边界）
// 方案2：用 streaming markdown 库（react-markdown + remark-gfm 的 streaming 模式）
// 方案3：补全未闭合的 Markdown 标记

function patchIncompleteMarkdown(text: string): string {
  // 统计未闭合的代码块
  const codeFences = (text.match(/```/g) || []).length
  if (codeFences % 2 !== 0) {
    text += '\n```'  // 补全代码块
  }
  return text
}

const html = computed(() => marked.parse(patchIncompleteMarkdown(content.value)))
```

#### 问题5：流式敏感信息拦截

```ts
// AI 输出中可能包含手机号、身份证号、Token 等敏感信息
// 需要在流式输出时实时拦截

const SENSITIVE_PATTERNS = [
  /1[3-9]\d{9}/g,                          // 手机号
  /\d{18}[\dXx]/g,                         // 身份证
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,    // JWT Token
  /[a-zA-Z0-9]{32,}/g                       // API Key
]

function sanitizeStream(text: string): string {
  let sanitized = text
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '***')
  }
  return sanitized
}

// 在 token 累积时过滤
reader.on('token', (token) => {
  buffer += token
  // 注意：敏感信息可能跨 token，需要在段落边界做完整过滤
})
```

#### 问题6：流式中断与断线续传

```ts
// 用户点"停止" → 中断 fetch
function stop() {
  abortController?.abort()
}

// 断线续传：记录已接收的 token 偏移
let receivedTokens = 0

async function resume() {
  const res = await fetch('/api/agent/chat', {
    body: JSON.stringify({
      message: originalMessage,
      offset: receivedTokens  // 告诉后端从哪继续
    })
  })
  // 继续接收...
}
```

---

## 四、意图识别

### 4.1 什么是意图识别？

```
用户输入："帮我请个假"
  → 意图：请假申请
  → 路由到：LeaveRequestAgent
  → 提取参数：请假类型、时间、原因

用户输入："今天天气怎么样"
  → 意图：天气查询
  → 路由到：WeatherAgent

用户输入："组织架构图里技术部有几个人"
  → 意图：组织架构查询
  → 路由到：OrgQueryAgent
```

### 4.2 实现方式一：LLM 意图分类

```ts
// intent.service.ts
@Injectable()
export class IntentService {
  constructor(private readonly llm: LlmService) {}

  async recognize(userInput: string): Promise<Intent> {
    const response = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content: `你是一个意图分类器。根据用户输入判断意图，返回 JSON。
可用意图：
- leave_request: 请假申请
- attendance_query: 考勤查询
- org_query: 组织架构查询
- general_chat: 通用闲聊

返回格式：{ "intent": "leave_request", "confidence": 0.95, "params": { "type": "年假" } }`
        },
        { role: 'user', content: userInput }
      ],
      response_format: { type: 'json_object' }  // 强制 JSON 输出
    })

    return JSON.parse(response.content)
  }
}
```

### 4.3 实现方式二：Supervisor 路由（多 Agent 编排）

```
用户输入
  ↓
Supervisor Agent（用 LLM 判断该路由给谁）
  ↓
  ├── LeaveRequestAgent（请假专家）
  ├── OrgQueryAgent（组织架构专家）
  ├── WeatherAgent（天气专家）
  └── GeneralChatAgent（通用闲聊）
```

```ts
// supervisor.service.ts
@Injectable()
export class SupervisorService {
  async route(userInput: string, context: AgentContext): Promise<AgentResponse> {
    const decision = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content: `你是 Supervisor，负责把用户请求路由给合适的 Agent。
可用 Agent：
- leave_agent: 处理请假、销假
- org_agent: 处理组织架构查询
- general_agent: 通用对话

返回 JSON：{ "agent": "leave_agent", "reason": "用户要请假" }`
        },
        { role: 'user', content: userInput }
      ],
      response_format: { type: 'json_object' }
    })

    const { agent } = JSON.parse(decision.content)
    return this.agents[agent].run(userInput, context)
  }
}
```

### 4.4 意图识别的工程化要点（2026 实践）

**只靠 LLM 一次分类是不够的，业界标准是"分层路由 + 置信度兜底"：**

```
用户输入
  ↓
第 1 层：确定性规则（关键词/正则/精确匹配）→ 能确定直接路由，覆盖 70-80% 请求
  ↓ 无法确定
第 2 层：LLM 分类（返回 intent + confidence + reason + params）
  ↓
confidence ≥ 阈值（建议 0.7）→ 路由
confidence < 阈值 → 澄清反问 / 落入通用 Agent / 转人工（绝不明知不确定还路由）
```

**面试必说的高频坑：**

1. **静默错路由**：低置信度也硬路由，比不路由更糟——用户会被错误 Agent 带偏，且难以追溯。必须设阈值 + 兜底行为。
2. **参数抽取要和意图绑定**：识别出 `leave_request` 只是第一步，还要校验参数（请假类型、时间、原因）是否齐全；缺参数走澄清，而不是直接执行。
3. **规则层优先是省钱方案**：高频明确请求（"请假""查考勤"）用关键词/正则就能 100% 确定，不必每次调 LLM；LLM 只处理模糊输入。
4. **结果要带 confidence 和 reason**：`reason` 用于排查错误路由和评测，纯 `{ intent }` 无法定位问题。

---

## 五、文本切片（Chunking）与上下文管理

### 5.1 为什么需要切片？

```
LLM 的上下文窗口有限（Claude 200K tokens、GPT-4 128K tokens）
但企业知识库可能有几百万字 → 必须切片 + 向量检索

用户的提问："理想汽车请假流程是什么？"
  → 向量检索找到相关文档片段
  → 只把相关片段塞进 context
  → LLM 据此回答
```

### 5.2 切片策略

```ts
// chunking.service.ts
@Injectable()
export class ChunkingService {
  // 策略1：固定长度切片（简单）
  chunkBySize(text: string, chunkSize = 500, overlap = 50): string[] {
    const chunks = []
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      chunks.push(text.slice(i, i + chunkSize))
    }
    return chunks
  }

  // 策略2：按语义切片（推荐 — 按段落/标题切）
  chunkBySemantic(text: string): string[] {
    // 按双换行（段落）切
    const paragraphs = text.split(/\n\s*\n/)

    // 过小的段落合并
    const chunks = []
    let current = ''
    for (const p of paragraphs) {
      if ((current + p).length < 300) {
        current += '\n\n' + p
      } else {
        if (current) chunks.push(current)
        current = p
      }
    }
    if (current) chunks.push(current)
    return chunks
  }

  // 策略3：按 Markdown 标题切（文档结构感知）
  chunkByMarkdown(text: string): Chunk[] {
    const sections = []
    const lines = text.split('\n')
    let currentSection = { heading: '', content: '', level: 0 }

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
      if (headingMatch) {
        if (currentSection.content) sections.push({ ...currentSection })
        currentSection = {
          heading: headingMatch[2],
          level: headingMatch[1].length,
          content: line + '\n'
        }
      } else {
        currentSection.content += line + '\n'
      }
    }
    if (currentSection.content) sections.push(currentSection)
    return sections
  }
}
```

**切片策略怎么选（2026 实践）：**

1. **先做基线，再优化**：递归字符切分（500-1024 tokens + 10%-20% overlap）先跑通全链路，用评测数据决定要不要换策略——不要一上来就上"最花哨"的切法。
2. **Vectara 2026 研究提醒**：在它们的测试里，递归 512-token 切分（69% 准确率）反而超过语义切分（54%）。说明切分策略必须和文档类型、Embedding 模型、检索方式匹配，**没有银弹**。
3. **结构文档优先结构边界**：Markdown 标题、表格前后、代码块、列表结束处是天然语义边界；中文文档在句号/换行处切，避免把一句话拆成两半。
4. **需要大上下文时用 parent-child（父子分块）**：子块（小，如 400 tokens）用于检索，命中后回取父块（整节/整章）喂给 LLM 生成——既保证召回粒度，又不丢失上下文。
5. **语义切分适合长文本散文**，但依赖 Embedding 质量；Embedding 弱时语义切分不如递归切分，这是 2026 年反复出现的结论。

### 5.3 Token 预算治理（三级内容分层）

```
2026 年最佳实践：L0/L1/L2 三级分辨率

L0 Abstract  (~100 tokens) — 一句话摘要
L1 Overview  (~300 tokens) — 详细要点
L2 Full      (完整文档)    — 全文

检索时按相关度选档：
  score > 0.8 → 注入 L1（详细要点）
  score ≤ 0.8 → 注入 L0（摘要）
  用户主动追问 → 展开 L2（全文）

这样每次注入只占 100-300 tokens，不爆上下文窗口。
```

```ts
// context.service.ts
@Injectable()
export class ContextService {
  async buildContext(query: string, maxTokens = 4000): Promise<string> {
    // 1. 向量检索
    const results = await this.vectorSearch(query, 10)

    // 2. 按相关度选档
    const contextPieces = []
    let usedTokens = 0

    for (const result of results) {
      const content = result.score > 0.8 ? result.l1 : result.l0
      const tokens = this.estimateTokens(content)

      if (usedTokens + tokens > maxTokens) break  // 不超预算

      contextPieces.push(content)
      usedTokens += tokens
    }

    return contextPieces.join('\n---\n')
  }

  private estimateTokens(text: string): number {
    // 粗略估算：1 token ≈ 4 字符（英文）/ 2 字符（中文）
    return Math.ceil(text.length / 3)
  }
}
```

### 5.4 什么是向量数据库

**Embedding 先于向量库**：Embedding 模型把文本变成一串数字向量，语义相近的文本向量距离近。向量数据库就是专门做"**按向量距离找最近邻**"的存储与检索系统。

**和传统数据库的本质区别：**

| | 传统数据库（MySQL） | 向量数据库 |
|---|---|---|
| 查询方式 | 精确匹配 `WHERE name = 'x'` | 语义相似度检索 |
| 排序依据 | 条件/B+Tree | 向量距离（余弦/内积/欧氏） |
| 核心问题 | "有没有这个值" | "和这句话最像的是什么" |

**为什么用 ANN（近似最近邻）而不是精确搜索？** 数据量上千万时，精确比对每个向量是 O(N)，太慢；HNSW 等索引算法把复杂度降到 O(logN)，代价是"近似"——结果可能不是全局最优，但 95%+ 场景够用。

**两个高频索引算法一句话对比：**

- **HNSW**：多层图 + 贪心搜索，查询快、无需训练，但内存占用大——大多数项目默认选它；
- **IVFFLAT**：先聚类再在最近的桶里搜，内存小，但需要训练、召回率略低，适合超大规模且能接受训练成本。

**面试最重要的一句话**：相似度度量方式必须和 Embedding 模型训练方式、向量是否归一化、索引配置保持一致——模型用余弦训练的，检索就别换内积；用了归一化向量，欧氏距离和余弦等价，但别混着算。

**选型速记：** 已有 PostgreSQL 且数据量不大 → `pgvector` 扩展最省事；大规模独立检索 → Milvus / Qdrant；不想运维 → Pinecone 等 SaaS；业务里已有 Elasticsearch → 直接用其向量能力。

### 5.5 RAG vs 微调（高频面试）

**一句话定位：RAG 管“知道什么”，微调管“怎么说话 / 做事”。**

| 维度 | RAG（检索增强生成） | Fine-tuning（微调） |
|---|---|---|
| 解决的问题 | 模型不知道的知识、实时/私有文档 | 输出风格、格式、领域能力、稳定模式 |
| 原理 | 文档切分 → Embedding → 向量检索 → 相关片段注入上下文 | 用领域数据继续训练，更新模型权重 |
| 数据要求 | 文档库，不需要训练数据 | 高质量标注数据集，需要规模与多样性 |
| 更新知识 | 改文档 / 重建索引即可，成本低、周期短 | 重新训练、评测、部署，成本高 |
| 幻觉抑制 | 有文档约束，相对可控 | 靠训练数据质量，无法实时纠偏 |
| 选型口诀 | 缺知识先上 RAG | 行为模式稳定且高频重复才考虑微调；先用 Prompt 试，再 RAG，最后微调 |

**面试话术：** "RAG 解决知识时效性和私有知识的问题，不需要训练，更新知识就是更新文档库；微调解决输出能力与风格问题，需要数据集和重训成本。我目前没有完整搭建过 Agent，但 RAG 的链路（切分、Embedding、向量检索、上下文注入）和两者的选型逻辑已经清楚。"

**参考：** 腾讯云《RAG 和 Fine-tuning 有什么区别》（2026-07）— https://cloud.tencent.com.cn/developer/article/2703879 ；InfoQ《AI Agent 高频面试 Top 20》（2026-05）— https://xie.infoq.cn/article/8960744994b927abcaff938fa

---

## 六、LLM API 选型：Chat Completions vs Responses API

### 6.1 一句话概括

```
Chat Completions API：第一代对话接口（/v1/chat/completions）
  → messages 数组 → choices[0].message.content
  → 为"对话"设计，Agent 能力靠开发者自己拼

Responses API：新一代统一接口（/v1/responses）
  → input → output（类型化数组）
  → 为"Agent"设计：内置工具调用、状态管理、推理保留
  → 2025 年发布，代表 OpenAI 未来方向（GPT-5 起官方推荐）
```

### 6.2 核心区别对比

| 维度 | Chat Completions | Responses API |
|------|-----------------|---------------|
| 端点 | `/v1/chat/completions` | `/v1/responses` |
| 请求参数 | `messages[]` | `input`（兼容 messages 格式） |
| 响应结构 | `choices[0].message.content` | `output[]`（类型化：message/reasoning/function_call） |
| 状态管理 | **手动**（自己拼接历史 messages） | 内置：`previous_response_id` 链式/Conversations API |
| 工具调用 | 支持，需手动编排多轮 | 原生支持，工具循环更流畅 |
| 推理保留 | ❌ 不支持跨轮保留思路链 | ✅ 保留 reasoning items（GPT-5 起） |
| 内置工具 | ❌ | ✅ `web_search`、`file_search`、`code_interpreter` |
| 结构化输出 | `response_format` | `text.format`（新结构） |
| 流式 | SSE chunks 无类型区分 | 类型化事件（response.reasoning/response.output_text） |
| SDK 辅助 | 无 | `output_text` 辅助属性 |
| 存储 | 默认存储（可 store: false） | 默认存储（可 store: false） |

### 6.3 请求对比

```js
// === Chat Completions ===
const res = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}` },
  body: JSON.stringify({
    model: 'gpt-5.6',
    messages: [
      { role: 'system', content: '你是助手' },
      { role: 'user', content: '你好' }
    ],
    tools: [{ type: 'function', function: { name: 'getWeather', ... } }]
  })
})
const data = await res.json()
console.log(data.choices[0].message.content)  // 文本

// === Responses API ===
const res2 = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}` },
  body: JSON.stringify({
    model: 'gpt-5.6',
    input: '你好',   // 兼容 messages 数组，也接受字符串
    tools: [{ type: 'web_search' }, { type: 'function', name: 'getWeather', ... }],
    // 状态链：传上一轮的 response id，OpenAI 帮你记住上下文
    previous_response_id: 'resp_xxx'
  })
})
const data2 = await res2.json()
console.log(data2.output_text)      // SDK 辅助属性
console.log(data2.output)           // 类型化数组：message / reasoning / function_call
```

### 6.4 响应结构对比 — 为什么 output 数组是"为 Agent 设计的"

```json
// Chat Completions 响应：只有一个 message，工具调用和推理混在一起
{
  "choices": [{
    "message": { "role": "assistant", "content": "...", "tool_calls": [...] }
  }]
}

// Responses API 响应：output 是类型化数组，每个 Item 独立
{
  "output": [
    { "type": "reasoning", "summary": [...] },              // 推理过程（单独）
    { "type": "function_call", "name": "getWeather", "arguments": "..." },  // 工具调用（单独）
    { "type": "message", "content": [{ "type": "output_text", "text": "..." }] }  // 最终回答（单独）
  ]
}
```

**对 Agent 工程的意义：** 前端不需要自己解析混在一起的工具调用文本，每个 Item 类型清晰，直接驱动 UI 渲染不同的卡片（推理块、工具调用块、文本块）。

### 6.5 对 Agent 工程的影响（面试答题重点）

```
面试问题："你搭 Agent 时用 Chat Completions 还是 Responses？为什么？"

回答框架：
1. 简单对话 → Chat Completions 够用，生态成熟、资料多
2. 复杂 Agent（多轮工具调用 + 推理）→ Responses 更合适：
   a. 状态管理内置（previous_response_id），不用自己拼 messages
   b. 推理链可保留（reasoning items），工具调用更准确
   c. 内置工具（web_search）开箱即用
   d. 响应类型化，前端渲染更清晰
3. 迁移注意：
   a. 老代码 choices[0].message.content → output_text
   b. response_format → text.format
   c. 流式事件类型不同，需要改 chunk 处理
4. 2026-08-26 Assistants API 正式下线 → 已迁移到 Responses
```

### 6.6 面试速答

| 问题 | 要点 |
|------|------|
| 两者本质区别？ | CC=对话接口；Responses=Agent 统一接口 |
| 状态怎么管理？ | CC 手动拼 messages；Responses 用 previous_response_id |
| 推理保留？ | 只有 Responses 支持跨轮保留 reasoning items |
| 内置工具？ | 只有 Responses 有 web_search/file_search/code_interpreter |
| 迁移改什么？ | 端点、output 读取、response_format→text.format、流式事件 |
| 怎么选？ | 简单对话用 CC；Agent 工作流用 Responses |

---

## 七、Agent Loop 的工程细节

### 7.1 防止无限循环

```ts
// 1. 最大迭代次数
const MAX_ITERATIONS = 10
if (iteration >= MAX_ITERATIONS) {
  yield { type: 'error', content: 'Agent 超过最大迭代次数' }
  return
}

// 2. 超时控制
const timeout = setTimeout(() => {
  yield { type: 'error', content: 'Agent 超时' }
  return
}, 60000)  // 60 秒

// 3. 重复检测（LLM 反复调同一个工具同一参数）
const toolCallHistory: string[] = []
const callKey = `${toolCall.name}:${JSON.stringify(toolCall.args)}`
if (toolCallHistory.includes(callKey)) {
  // LLM 在死循环，强制退出
  messages.push({
    role: 'system',
    content: '你已经调用过这个工具了，请直接基于已有信息回答'
  })
  continue
}
toolCallHistory.push(callKey)
```

### 7.2 错误处理与重试

```ts
async executeTool(name: string, args: any, context: AgentContext) {
  const maxRetries = 3
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await this.toolRegistry.execute(name, args, context)
    } catch (err) {
      if (i === maxRetries - 1) {
        // 最后一次也失败，返回错误信息给 LLM
        return { error: `工具 ${name} 执行失败：${err.message}` }
      }
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)))  // 指数退避
    }
  }
}
```

### 7.3 Human-in-the-Loop（人工确认）

```
敏感操作（发邮件、删数据、修改配置）需要人工确认：

LLM: "我要调用 sendEmail 工具"
  ↓
Agent: 暂停 Loop，推送 tool_call 事件到前端
  ↓
前端: 弹窗"AI 想发送邮件给 Bob，内容是...，确认？"
  ↓
用户: 点击"确认" / "拒绝" / "修改参数"
  ↓
Agent: 根据用户反馈继续 Loop
```

```ts
// 在 Agent Loop 中插入人工确认
if (this.toolRegistry.isDangerous(toolCall.name)) {
  yield { type: 'human_approval_required', tool: toolCall.name, args: toolCall.args }

  // 等待前端回传用户决策
  const decision = await this.waitForHumanApproval(toolCall.id)
  if (decision.approved) {
    const result = await this.toolRegistry.execute(toolCall.name, toolCall.args, context)
    // ...
  } else {
    messages.push({
      role: 'system',
      content: `用户拒绝了 ${toolCall.name} 调用。原因：${decision.reason}`
    })
  }
}
```

---

## 八、Agent 状态管理

### 8.1 会话状态

```ts
interface AgentSession {
  id: string                    // 会话 ID
  userId: string                // 用户 ID
  messages: Message[]           // 完整对话历史
  currentLoop: number           // 当前 Loop 迭代次数
  pendingToolCalls: ToolCall[]  // 待执行的工具调用
  context: AgentContext         // 用户上下文（页面、权限等）
  createdAt: Date
  updatedAt: Date
}

// 用 Redis 存储会话状态（支持多实例部署）
@Injectable()
export class SessionStore {
  constructor(private readonly redis: Redis) {}

  async create(userId: string): Promise<AgentSession> { ... }
  async get(sessionId: string): Promise<AgentSession> { ... }
  async save(session: AgentSession): Promise<void> { ... }
  async appendMessage(sessionId: string, message: Message): Promise<void> { ... }
}
```

### 8.2 检查点（Checkpoint）— 支持回滚

```
Agent Loop 每一轮都可以存检查点：
  Loop 1: messages = [user, assistant(tool_call)]
  Loop 2: messages = [user, assistant, tool_result, assistant(tool_call)]
  Loop 3: messages = [user, assistant, tool_result, assistant, tool_result, assistant(final)]

如果第 3 轮结果不好，可以回滚到第 2 轮重新执行。
```

---

## 九、你的理想同事项目实战话术

> "理想同事是一个 Agent 问答 H5，员工可以用自然语言让 AI 帮忙请假、查考勤、分析组织架构。我负责前端和 Agent 交互层。
>
> **后端架构**：用 NestJS 搭建，核心是 ReAct Loop——LLM 推理 + 工具调用循环。工具用 NestJS Service 实现（查员工信息、发邮件、查考勤），通过 Function Calling 暴露给 LLM。用 SSE 做流式输出，每个 Loop 迭代都推送 thinking/tool_call/tool_result 事件到前端。
>
> **前端交互**：我用 Vue3 封装了 useAgent composable——接收 SSE 事件流，实时渲染 Agent 的思考过程和工具调用。用户能看到'AI 正在查询员工信息'这样的中间状态，不是干等。用 AbortController 支持中断。
>
> **意图识别**：用 LLM 做意图分类，把请求路由给不同的专职 Agent（请假 Agent、考勤 Agent、组织架构 Agent）。
>
> **上下文管理**：知识库文档做了三级切片（L0 摘要/L1 要点/L2 全文），按向量检索相关度选档注入，控制 Token 预算不超窗口。"

---

## 十、面试速查

| 问题 | 要点 |
|------|------|
| ReAct 是什么？ | Reason + Act 循环：推理 → 调工具 → 观察 → 再推理 |
| Agent Loop 怎么实现？ | while 循环 + LLM 判断是否调工具 + 最大迭代防死循环 |
| NestJS 怎么搭 Agent？ | Controller(@Sse) + Service(Loop 编排) + ToolRegistry(工具) |
| 前端怎么接收 Agent 流？ | POST + fetch readable stream（不能用 EventSource，只支持 GET） |
| 意图识别怎么做？ | LLM 分类（response_format: json）或 Supervisor 路由 |
| 文本切片策略？ | 固定长度 / 语义切片 / Markdown 结构切；三级 L0/L1/L2 分辨率 |
| Token 预算治理？ | 按相关度选档：>0.8 注 L1，≤0.8 注 L0，追问展开 L2 |
| 怎么防无限循环？ | MAX_ITERATIONS + 超时 + 重复调用检测 |
| Human-in-the-Loop？ | 敏感操作暂停 Loop → 推前端确认 → 用户决策后继续 |
| 你项目怎么用的？ | 见第八节话术 |
