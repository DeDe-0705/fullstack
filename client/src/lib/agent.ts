import { queryOptions } from '@tanstack/react-query'
import { api, BASE_URL, DEMO_TOKEN } from './api'

export interface AgentUser {
  id: string
  name: string
  createdAt: string
}

export interface AgentConversation {
  id: string
  userId: string
  title: string
  createdAt: string
  updatedAt: string
}

export type AgentMessageRole = 'user' | 'assistant' | 'tool' | 'system'

// completed 正常完成 / aborted 用户中断 / error 上游异常
export type AgentMessageStatus = 'completed' | 'aborted' | 'error'

export interface AgentMessage {
  id: string
  conversationId: string
  role: AgentMessageRole
  content: string
  reasoning?: string | null
  status?: AgentMessageStatus
  tokenUsage?: AgentUsage | null
  thinkingMs?: number | null
  provider?: string | null
  model?: string | null
  toolCalls?: AgentToolTrace[] | null
  createdAt: string
}

export interface AgentToolTrace {
  name: string
  arguments: string
  result: string
}

// 供应商无关的统一用量结构（OpenAI 兼容），与 server 端 MessageUsage 对齐
export interface AgentUsage {
  completion_tokens: number
  prompt_tokens: number
  prompt_cache_hit_tokens?: number
  prompt_cache_miss_tokens?: number
  total_tokens: number
  prompt_tokens_details?: {
    cached_tokens?: number
  }
  completion_tokens_details?: {
    reasoning_tokens?: number
  }
}

export interface AgentChatResponse {
  reply: string
  conversationId: string
  toolCalls: AgentToolTrace[]
  usage: AgentUsage | null
}

export interface AgentDoneResult {
  conversationId: string
  toolCalls: AgentToolTrace[]
  usage: AgentUsage | null
  thinkingMs: number | null
  assistantMessage: AgentMessage
}

export interface AgentStreamHandlers {
  onReady?: (conversationId: string) => void
  onReasoning?: (delta: string) => void
  onContent?: (delta: string) => void
  onTool?: (trace: AgentToolTrace) => void
  onUsage?: (usage: AgentUsage) => void
  onDone?: (result: AgentDoneResult) => void
}

export interface Paginated<T> {
  items: T[]
  total: number
}

export const createUser = (name: string) =>
  api.post<AgentUser>('/users', { name })

export const getUserByName = (name: string) =>
  api.get<AgentUser>(`/users/by-name/${encodeURIComponent(name)}`)

export const userConversationsOptions = (userId: string | undefined) =>
  queryOptions({
    queryKey: ['agent', 'conversations', userId],
    queryFn: () =>
      api.get<Paginated<AgentConversation>>(`/users/${userId}/conversations`),
    // 用户还没就绪时先不请求，避免无效查询
    enabled: Boolean(userId),
  })

export const messagesOptions = (conversationId: string | undefined) =>
  queryOptions({
    queryKey: ['agent', 'messages', conversationId],
    queryFn: () =>
      api.get<Paginated<AgentMessage>>(`/conversations/${conversationId}/messages`),
    enabled: Boolean(conversationId),
  })

export const createConversation = (input: { userId: string; title?: string }) =>
  api.post<AgentConversation>('/conversations', input)

export const sendChat = (input: {
  userId: string
  conversationId?: string
  message: string
}) => api.post<AgentChatResponse>('/agent/chat', input)

// 流式对话：用 fetch 手动解析 SSE，POST 请求可以把参数放 body，EventSource 做不到
export async function sendChatStream(
  input: { userId: string; conversationId?: string; message: string },
  handlers: AgentStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/agent/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${DEMO_TOKEN}`,
    },
    body: JSON.stringify(input),
    signal,
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    const error = new Error(text ? text.slice(0, 200) : `API error: ${res.status}`) as Error & {
      status?: number
    }
    error.status = res.status
    throw error
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let eventName = 'message'
  let dataLines: string[] = []

  const dispatch = () => {
    const raw = dataLines.join('\n')
    dataLines = []
    if (!raw) return

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return
    }

    switch (eventName) {
      case 'ready':
        if (typeof payload.conversationId === 'string') {
          handlers.onReady?.(payload.conversationId)
        }
        break
      case 'reasoning':
        if (typeof payload.delta === 'string') handlers.onReasoning?.(payload.delta)
        break
      case 'content':
        if (typeof payload.delta === 'string') handlers.onContent?.(payload.delta)
        break
      case 'tool':
        if (typeof payload.name === 'string') {
          handlers.onTool?.({
            name: payload.name,
            arguments: typeof payload.arguments === 'string' ? payload.arguments : '',
            result: typeof payload.result === 'string' ? payload.result : '',
          })
        }
        break
      case 'usage':
        // server 端领域事件为 { usage: {...} } 嵌套结构
        if (payload.usage) handlers.onUsage?.(payload.usage as AgentUsage)
        break
      case 'done':
        handlers.onDone?.(payload as unknown as AgentDoneResult)
        break
      case 'error':
        throw new Error(
          typeof payload.message === 'string' ? payload.message : 'Agent 流式响应失败',
        )
    }
    eventName = 'message'
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let newlineIndex: number
      while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, '')
        buffer = buffer.slice(newlineIndex + 1)
        // 空行表示一个 SSE 事件结束，此时把累积的 event/data 派发出去
        if (!line) {
          dispatch()
          continue
        }
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart())
        }
        // 注释行（: 开头）按 SSE 规范忽略
      }
    }

    // 处理末尾可能没有换行收尾的残留片段
    const tail = buffer.replace(/\r$/, '')
    if (tail.startsWith('event:')) {
      eventName = tail.slice(6).trim()
    } else if (tail.startsWith('data:')) {
      dataLines.push(tail.slice(5).trimStart())
    }
    dispatch()
  } finally {
    reader.releaseLock()
  }
}
