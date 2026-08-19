import type { AgentToolTrace, AgentUsage } from '@/lib/agent'
import { create } from 'zustand'

export interface AgentTurnMeta {
  messageId: string;
  thinkingMs: number | null;
  usage: AgentUsage | null;
}

interface ChatState {
  streamingConversationId: string | undefined,
  streaming: boolean
  streamReasoning: string
  streamContent: string
  streamTools: AgentToolTrace[]
  lastMeta: AgentTurnMeta | null
  lastToolCalls: AgentToolTrace[]
}

interface ChatAction {
  setStreamingConversationId: (id?: string) => void;
  startStreaming: () => void
  stopStreaming: () => void
  appendReasoning: (delta: string) => void
  appendContent: (delta: string) => void
  addTool: (trace: AgentToolTrace) => void
  finishTurn: (meta: AgentTurnMeta | null, toolCalls: AgentToolTrace[]) => void
  resetState: () => void
}

export const useChatStore = create<ChatState & ChatAction>(
  (set, get) => {
    return {
      streamingConversationId: undefined,
      streaming: false,
      streamReasoning: '',
      streamContent: '',
      streamTools: [],
      lastMeta: null,
      lastToolCalls: [],
      setStreamingConversationId: (id?: string) => set({ streamingConversationId: id }),
      startStreaming: () => {
        set({
          streaming: true,
          streamReasoning: '',
          streamContent: '',
          streamTools: [],
          lastMeta: null,
          lastToolCalls: []
        })
      },
      stopStreaming: () => set({ streaming: false }),
      appendReasoning: (delta) => set((s) => ({ streamReasoning: s.streamReasoning + delta })),
      appendContent: (delta) => set((s) => ({ streamContent: s.streamContent + delta })),
      addTool: (trace: AgentToolTrace) => {
        set({
          streamTools: get().streamTools.concat(trace)
        })
      },
      finishTurn: (meta: AgentTurnMeta | null, toolCalls: AgentToolTrace[]) => {
        set({
          lastMeta: meta,
          lastToolCalls: toolCalls,
          streamContent: '',
          streamReasoning: '',
          streamTools: [],
          streamingConversationId: undefined
        })
      },
      resetState: () => {
        set({
          lastMeta: null,
          lastToolCalls: [],
          streamContent: '',
          streamReasoning: '',
          streamTools: []
        })
      }
    }
  }
)