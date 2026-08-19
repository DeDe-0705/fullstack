import { Flex, Space, Typography, Spin, Card, Collapse, List } from "antd";
import { ChatMarkdown } from "@/components/ChatMarkdown";
import { useChatStore } from "@/stores/chat";
import { messagesOptions, type AgentToolTrace } from "@/lib/agent";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

const ROLE_LABEL: Record<string, string> = {
  user: "用户",
  assistant: "助手",
  tool: "工具",
  system: "系统",
};

// 工具调用轨迹的通用渲染：流式中和会话结束后复用
function ToolTraceList({ traces }: { traces: AgentToolTrace[] }) {
  return (
    <List
      size="small"
      dataSource={traces}
      renderItem={(trace) => (
        <List.Item>
          <Flex vertical gap={4}>
            <Typography.Text code style={{ fontSize: 12 }}>
              {trace.name}({trace.arguments})
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              → {trace.result}
            </Typography.Text>
          </Flex>
        </List.Item>
      )}
    />
  );
}

export interface MessageComponentProps {
  conversationId: string;
}

export function MessageComponent({ conversationId }: MessageComponentProps) {
  const {
    streaming,
    streamReasoning,
    streamContent,
    streamTools,
    lastMeta,
    lastToolCalls,
  } = useChatStore();
  const messagesQuery = useQuery(messagesOptions(conversationId));

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [
    messagesQuery.data,
    streaming,
    streamContent,
    streamReasoning,
    streamTools,
  ]);
  return (
    <Flex vertical gap={12} style={{ flex: 1, overflowY: "auto", padding: 16 }}>
      {conversationId && messagesQuery.isPending && (
        <Flex justify="center" style={{ padding: 32 }}>
          <Spin />
        </Flex>
      )}
      {messagesQuery.data?.items.map((message) => (
        <Flex
          key={message.id}
          justify={message.role === "user" ? "flex-end" : "flex-start"}
        >
          <Card
            size="small"
            style={{
              maxWidth: "75%",
              background: message.role === "user" ? "#e6f4ff" : "#fafafa",
            }}
          >
            {message.role !== "user" && message.role !== "assistant" && (
              <Typography.Text
                type="secondary"
                style={{ display: "block", fontSize: 10, marginBottom: 4 }}
              >
                {ROLE_LABEL[message.role]}
              </Typography.Text>
            )}
            {message.role === "assistant" ? (
              <>
                {message.reasoning && (
                  <Collapse
                    size="small"
                    ghost
                    items={[
                      {
                        key: "reasoning",
                        label: "思考过程",
                        children: (
                          <Typography.Paragraph
                            style={{
                              margin: 0,
                              whiteSpace: "pre-wrap",
                              maxHeight: 192,
                              overflowY: "auto",
                            }}
                          >
                            {message.reasoning}
                          </Typography.Paragraph>
                        ),
                      },
                    ]}
                  />
                )}
                <ChatMarkdown content={message.content} />
                {lastMeta?.messageId === message.id &&
                  (lastMeta.thinkingMs != null || lastMeta.usage) && (
                    <Typography.Text
                      type="secondary"
                      style={{
                        display: "block",
                        fontSize: 12,
                        marginTop: 8,
                      }}
                    >
                      {lastMeta.thinkingMs != null &&
                        `思考 ${(lastMeta.thinkingMs / 1000).toFixed(1)} 秒`}
                      {lastMeta.thinkingMs != null && lastMeta.usage && " · "}
                      {lastMeta.usage &&
                        `使用 ${lastMeta.usage.total_tokens} tokens` +
                          (lastMeta.usage.completion_tokens_details
                            ?.reasoning_tokens
                            ? `（推理 ${lastMeta.usage.completion_tokens_details.reasoning_tokens}）`
                            : "")}
                    </Typography.Text>
                  )}
              </>
            ) : (
              <Typography.Text style={{ whiteSpace: "pre-wrap" }}>
                {message.content}
              </Typography.Text>
            )}
          </Card>
        </Flex>
      ))}

      {(streaming ||
        streamReasoning ||
        streamContent ||
        streamTools.length > 0) && (
        <Flex justify="flex-start">
          <Card size="small" style={{ maxWidth: "75%", background: "#fafafa" }}>
            <Flex vertical gap={8}>
              {streamReasoning && (
                <Collapse
                  size="small"
                  ghost
                  items={[
                    {
                      key: "reasoning",
                      label: "思考过程",
                      children: (
                        <Typography.Paragraph
                          style={{
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            maxHeight: 192,
                            overflowY: "auto",
                          }}
                        >
                          {streamReasoning}
                        </Typography.Paragraph>
                      ),
                    },
                  ]}
                />
              )}
              {streamTools.length > 0 && (
                <Collapse
                  size="small"
                  ghost
                  items={[
                    {
                      key: "tools",
                      label: `工具调用（${streamTools.length}）`,
                      children: <ToolTraceList traces={streamTools} />,
                    },
                  ]}
                />
              )}
              {streamContent ? (
                <ChatMarkdown content={streamContent} />
              ) : (
                streaming && (
                  <Typography.Text type="secondary">
                    AI 思考中...
                  </Typography.Text>
                )
              )}
              {!streaming &&
                (streamReasoning ||
                  streamContent ||
                  streamTools.length > 0) && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    已停止生成
                  </Typography.Text>
                )}
            </Flex>
          </Card>
        </Flex>
      )}

      {lastToolCalls.length > 0 && (
        <Collapse
          size="small"
          items={[
            {
              key: "tool-calls",
              label: "本轮工具调用轨迹",
              children: <ToolTraceList traces={lastToolCalls} />,
            },
          ]}
        />
      )}
      <div ref={bottomRef} />
    </Flex>
  );
}
