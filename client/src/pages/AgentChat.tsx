import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  Collapse,
  Empty,
  Flex,
  Form,
  Input,
  Layout,
  List,
  Space,
  Spin,
  Typography,
} from "antd";
import {
  LogoutOutlined,
  PlusOutlined,
  RobotOutlined,
  SendOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { useSearchParams } from "react-router-dom";
import { useAgentStore } from "../stores/agent";
import { ChatMarkdown } from "../components/ChatMarkdown";
import {
  createConversation,
  createUser,
  getUserByName,
  messagesOptions,
  sendChatStream,
  userConversationsOptions,
} from "../lib/agent";
import type {
  AgentMessage,
  AgentToolTrace,
  AgentUsage,
  Paginated,
} from "../lib/agent";

const { Sider, Content } = Layout;

const ROLE_LABEL: Record<string, string> = {
  user: "用户",
  assistant: "助手",
  tool: "工具",
  system: "系统",
};

function isNotFound(error: unknown): boolean {
  return (error as { status?: number } | undefined)?.status === 404;
}

// 本轮回复的元信息：思考耗时 + token 用量，只展示最近一次
interface AgentTurnMeta {
  messageId: string;
  thinkingMs: number | null;
  usage: AgentUsage | null;
}

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

export function AgentChat() {
  const queryClient = useQueryClient();
  const { message: antdMessage } = App.useApp();
  const { userId, userName, setSession, clearSession } = useAgentStore();
  const [searchParams, setSearchParams] = useSearchParams();
  // 会话 ID 的唯一来源是 URL：刷新/分享链接后默认回到该会话，前进后退也会自动切换
  const conversationId = searchParams.get("conversation") ?? undefined;
  const [input, setInput] = useState("");
  const [lastToolCalls, setLastToolCalls] = useState<AgentToolTrace[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamReasoning, setStreamReasoning] = useState("");
  const [streamContent, setStreamContent] = useState("");
  const [streamTools, setStreamTools] = useState<AgentToolTrace[]>([]);
  const [lastMeta, setLastMeta] = useState<AgentTurnMeta | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 登录/注册：先按用户名查询，404 再走注册，避免把网络错误误判成"用户不存在"
  const loginMutation = useMutation({
    mutationFn: async (name: string) => {
      try {
        return await getUserByName(name);
      } catch (error) {
        if (isNotFound(error)) return createUser(name);
        throw error;
      }
    },
    onSuccess: (user) => setSession(user.id, user.name),
  });

  const conversationsQuery = useQuery(userConversationsOptions(userId));
  const messagesQuery = useQuery(messagesOptions(conversationId));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [
    messagesQuery.data,
    streaming,
    streamContent,
    streamReasoning,
    streamTools,
  ]);

  const createMutation = useMutation({
    mutationFn: createConversation,
    onSuccess: (conversation) => {
      setSearchParams({ conversation: conversation.id }, { replace: true });
      setLastToolCalls([]);
      setLastMeta(null);
      queryClient.invalidateQueries({
        queryKey: ["agent", "conversations", userId],
      });
    },
  });

  function handleLogin(values: { name: string }) {
    if (!loginMutation.isPending) loginMutation.mutate(values.name);
  }

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
    if (conversationId) appendMessage(conversationId);

    setInput("");
    setStreamReasoning("");
    setStreamContent("");
    setStreamTools([]);
    setLastToolCalls([]);
    setLastMeta(null);
    setStreaming(true);

    try {
      await sendChatStream(
        { userId, conversationId, message },
        {
          onReady: (id) => {
            setSearchParams({ conversation: id }, { replace: true });
            // 新会话在 ready 之前还不知道会话 ID，拿到后把用户消息补进新会话缓存
            if (!conversationId) appendMessage(id);
          },
          onReasoning: (delta) => setStreamReasoning((prev) => prev + delta),
          onContent: (delta) => setStreamContent((prev) => prev + delta),
          onTool: (trace) => setStreamTools((prev) => [...prev, trace]),
          onDone: (result) => {
            setLastToolCalls(result.toolCalls);
            setLastMeta({
              messageId: result.assistantMessage.id,
              thinkingMs: result.thinkingMs,
              usage: result.usage,
            });
            setStreamReasoning("");
            setStreamContent("");
            setStreamTools([]);
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
      setStreaming(false);
    }
  }

  function handleSubmit() {
    const message = input.trim();
    if (!message || streaming || !userId) return;
    void runChat(message);
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  function openConversation(id: string) {
    // 会话 ID 进 URL：刷新或分享链接都能直接回到该会话
    setSearchParams({ conversation: id }, { replace: true });
    setLastToolCalls([]);
    setStreamTools([]);
    setLastMeta(null);
  }

  function handleNewConversation() {
    if (!userId) return;
    createMutation.mutate({ userId });
  }

  if (!userId) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: "60vh" }}>
        <Card style={{ width: 360 }}>
          <Typography.Title level={4}>登录 / 注册</Typography.Title>
          <Typography.Paragraph type="secondary">
            输入用户名，已注册则直接进入，未注册则自动创建
          </Typography.Paragraph>
          <Form onFinish={handleLogin} layout="vertical" requiredMark={false}>
            <Form.Item
              name="name"
              rules={[{ required: true, message: "请输入用户名" }]}
            >
              <Input placeholder="用户名" maxLength={64} />
            </Form.Item>
            {loginMutation.isError && (
              <Alert
                type="error"
                showIcon
                message={
                  loginMutation.error instanceof Error
                    ? loginMutation.error.message
                    : "登录失败"
                }
                style={{ marginBottom: 16 }}
              />
            )}
            <Button
              type="primary"
              htmlType="submit"
              loading={loginMutation.isPending}
              block
            >
              进入
            </Button>
          </Form>
        </Card>
      </Flex>
    );
  }

  return (
    <Layout style={{ height: "calc(100vh - 96px)", background: "#fff" }}>
      {/* 会话列表 */}
      <Sider
        width={260}
        theme="light"
        style={{ borderRight: "1px solid #f0f0f0", background: "#fff" }}
      >
        <Flex vertical style={{ height: "100%" }}>
          <Flex
            justify="space-between"
            align="center"
            style={{ padding: "12px 16px" }}
          >
            <Typography.Text strong ellipsis style={{ maxWidth: 150 }}>
              {userName}
            </Typography.Text>
            <Button
              type="text"
              size="small"
              icon={<LogoutOutlined />}
              onClick={clearSession}
            >
              退出
            </Button>
          </Flex>
          <Flex style={{ padding: "0 16px 12px" }}>
            <Button
              type="primary"
              block
              icon={<PlusOutlined />}
              onClick={handleNewConversation}
              loading={createMutation.isPending}
              disabled={streaming}
            >
              新建会话
            </Button>
          </Flex>
          <Flex vertical style={{ flex: 1, overflowY: "auto" }}>
            <List
              loading={conversationsQuery.isPending}
              dataSource={conversationsQuery.data?.items ?? []}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="还没有会话"
                  />
                ),
              }}
              renderItem={(conversation) => (
                <List.Item
                  onClick={() => openConversation(conversation.id)}
                  style={{
                    cursor: streaming ? "not-allowed" : "pointer",
                    padding: "12px 16px",
                    background:
                      conversation.id === conversationId
                        ? "#e6f4ff"
                        : undefined,
                    opacity: streaming ? 0.5 : 1,
                  }}
                >
                  <Typography.Text
                    ellipsis
                    strong={conversation.id === conversationId}
                  >
                    {conversation.title}
                  </Typography.Text>
                </List.Item>
              )}
            />
          </Flex>
        </Flex>
      </Sider>

      {/* 聊天主区域 */}
      <Content
        style={{ display: "flex", flexDirection: "column", minWidth: 0 }}
      >
        <Flex
          justify="space-between"
          align="center"
          style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0" }}
        >
          <Space>
            <RobotOutlined style={{ color: "#1677ff" }} />
            <Typography.Text strong>DeepSeek Agent</Typography.Text>
          </Space>
        </Flex>

        <Flex
          vertical
          gap={12}
          style={{ flex: 1, overflowY: "auto", padding: 16 }}
        >
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
                          {lastMeta.thinkingMs != null &&
                            lastMeta.usage &&
                            " · "}
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
              <Card
                size="small"
                style={{ maxWidth: "75%", background: "#fafafa" }}
              >
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
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12 }}
                      >
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

        <Flex
          vertical
          gap={8}
          style={{ padding: 12, borderTop: "1px solid #f0f0f0" }}
        >
          <Space.Compact style={{ width: "100%" }}>
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
          </Space.Compact>
        </Flex>
      </Content>
    </Layout>
  );
}
