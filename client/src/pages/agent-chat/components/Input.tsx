import { sendChatStream } from "@/lib/agent";
import type { AgentMessage, Paginated } from "@/lib/agent";
import { useAgentStore } from "@/stores/agent";
import { useChatStore } from "@/stores/chat";
import { StopOutlined, SendOutlined } from "@ant-design/icons";
import { App, Button, Flex, Input } from "antd";
import { useRef, useState } from "react";
import { useConversationId } from "../hooks/useConversationId";
import { useQueryClient } from "@tanstack/react-query";

export function AgentInput() {
  const [input, setInput] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const { userId } = useAgentStore();
  const {
    streaming,
    startStreaming,
    stopStreaming,
    appendReasoning,
    appendContent,
    addTool,
    finishTurn,
    setStreamingConversationId,
  } = useChatStore();
  const { message: antdMessage } = App.useApp();

  const [conversationId, setConversationId] = useConversationId();
  const queryClient = useQueryClient();

  async function runChat(message: string) {
    if (!userId || streaming) return;
    const controller = new AbortController();
    abortRef.current = controller;

    // 乐观更新：先把用户消息写进当前会话缓存，不等接口返回，避免发送后界面空白
    const optimisticMessage: AgentMessage = {
      id: `local-${Date.now()}`,
      conversationId: conversationId ?? "",
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    const appendMessage = (id: string) => {
      queryClient.setQueryData<Paginated<AgentMessage>>(
        ["agent", "messages", id],
        (old) =>
          old
            ? {
                ...old,
                items: [...old.items, optimisticMessage],
                total: old.total + 1,
              }
            : { items: [optimisticMessage], total: 1 },
      );
    };
    if (conversationId) {
      appendMessage(conversationId);
      setStreamingConversationId(conversationId);
    }

    setInput("");
    startStreaming();

    try {
      await sendChatStream(
        { userId, conversationId: conversationId, message },
        {
          onReady: (id) => {
            setConversationId(id);
            setStreamingConversationId(id);
            // 新会话在 ready 之前还不知道会话 ID，拿到后把用户消息补进新会话缓存
            if (!conversationId) appendMessage(id);
          },
          onReasoning: (delta) => appendReasoning(delta),
          onContent: (delta) => appendContent(delta),
          onTool: (trace) => addTool(trace),
          onDone: (result) => {
            finishTurn(
              {
                messageId: result.assistantMessage.id,
                thinkingMs: result.thinkingMs,
                usage: result.usage,
              },
              result.toolCalls,
            );
            // 服务端已把消息落库，直接把真实消息写进缓存，避免刷新历史时闪没或重复
            queryClient.setQueryData<Paginated<AgentMessage>>(
              ["agent", "messages", result.conversationId],
              (old) =>
                old
                  ? {
                      ...old,
                      items: [...old.items, result.assistantMessage],
                      total: old.total + 1,
                    }
                  : { items: [result.assistantMessage], total: 1 },
            );
            queryClient.invalidateQueries({
              queryKey: ["agent", "conversations", userId],
            });
          },
        },
        controller.signal,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // 用户主动停止：保留已生成内容在气泡里，后端也会把它落库
        queryClient.invalidateQueries({
          queryKey: ["agent", "conversations", userId],
        });
      } else {
        antdMessage.error(error instanceof Error ? error.message : "请求失败");
      }
    } finally {
      abortRef.current = null;
      stopStreaming();
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }
  function handleSubmit() {
    const message = input.trim();
    if (!message || streaming || !userId) return;
    void runChat(message);
  }

  return (
    <Flex gap={8} style={{ padding: 12, borderTop: "1px solid #f0f0f0" }}>
      <Input
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onPressEnter={() => handleSubmit()}
        placeholder={streaming ? "AI 思考中..." : "输入消息"}
        disabled={streaming}
      />
      {streaming ? (
        <Button danger icon={<StopOutlined />} onClick={handleStop}>
          停止
        </Button>
      ) : (
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSubmit}
          disabled={!input.trim()}
        >
          发送
        </Button>
      )}
    </Flex>
  );
}
