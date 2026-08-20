import type { AgentToolTrace } from '@/lib/agent'
import { create } from 'zustand'

interface ChatState {
  // 流式内容归属的会话：切走后回来仍能看到实时的流
  streamingConversationId: string | undefined
  streaming: boolean
  streamReasoning: string
  streamContent: string
  streamTools: AgentToolTrace[]
}

interface ChatAction {
  setStreamingConversationId: (id?: string) => void
  startStreaming: () => void
  stopStreaming: () => void
  appendReasoning: (delta: string) => void
  appendContent: (delta: string) => void
  addTool: (trace: AgentToolTrace) => void
  finishTurn: () => void
  resetState: () => void
}

// 流式中的临时状态。轮次元信息（用量/耗时/工具轨迹）已随消息落库，
// 历史展示直接从 message 上读，store 不再保留 lastMeta/lastToolCalls
export const useChatStore = create<ChatState & ChatAction>(
  (set) => {
    return {
      streamingConversationId: undefined,
      streaming: false,
      streamReasoning: '',
      streamContent: '',
      streamTools: [],
      setStreamingConversationId: (id?: string) => set({ streamingConversationId: id }),
      startStreaming: () => {
        set({
          streaming: true,
          streamReasoning: '',
          streamContent: '',
          streamTools: [],
        })
      },
      stopStreaming: () => set({ streaming: false }),
      appendReasoning: (delta) => set((s) => ({ streamReasoning: s.streamReasoning + delta })),
      appendContent: (delta) => set((s) => ({ streamContent: s.streamContent + delta })),
      addTool: (trace: AgentToolTrace) =>
        set((s) => ({ streamTools: [...s.streamTools, trace] })),
      finishTurn: () => {
        set({
          streamReasoning: '',
          streamContent: '',
          streamTools: [],
          streamingConversationId: undefined,
        })
      },
      resetState: () => {
        set({
          streamReasoning: '',
          streamContent: '',
          streamTools: [],
        })
      },
    }
  }
)
