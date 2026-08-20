import {
  createConversation,
  editConversation,
  userConversationsOptions,
} from "@/lib/agent";
import { queryClient } from "@/lib/queryClient";
import { useAgentStore } from "@/stores/agent";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useConversationId } from "../hooks/useConversationId";
import { LogoutOutlined, PlusOutlined } from "@ant-design/icons";
import { Flex, Typography, Button, List, Empty, Input, App } from "antd";
import { useState } from "react";
import type { AgentConversation } from "@/lib/agent";
import { useChatStore } from "@/stores/chat";

interface AgentSessionItemProps {
  conversation: AgentConversation;
  streaming: boolean;
}

export function AgentSessionItem({
  conversation,
  streaming,
}: AgentSessionItemProps) {
  const [conversationId, setConversationId] = useConversationId();
  const isSelected = conversationId === conversation.id;
  const [isEdit, setIsEdit] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const { message: antdMessage } = App.useApp();

  const { userId } = useAgentStore();

  const resetState = useChatStore((s) => s.resetState);

  const editMutation = useMutation({
    mutationFn: (title: string) =>
      editConversation(userId as string, conversation.id, title),
    onSuccess: () => {
      antdMessage.success("修改成功");
      setIsEdit(false);
      // 标题的唯一数据源是服务端缓存，刷新列表而不是本地 state 打补丁
      queryClient.invalidateQueries({
        queryKey: ["agent", "conversations", userId],
      });
    },
    onError: (error) => {
      antdMessage.error(error instanceof Error ? error.message : "修改失败");
    },
  });

  function openConversation(id: string) {
    // 流式期间禁止切换会话，避免流式气泡归属错乱
    if (streaming) return;
    // 会话 ID 进 URL：刷新或分享链接都能直接回到该会话
    setConversationId(id);
    resetState();
  }

  function startEdit(event: React.MouseEvent) {
    // 阻止冒泡到 List.Item 的 onClick，否则双击编辑会先触发打开会话
    event.stopPropagation();
    setNewTitle(conversation.title);
    setIsEdit(true);
  }

  function submitEdit() {
    const title = newTitle.trim();
    // 空标题 / 没改动 / 提交中：直接退出编辑，不发请求
    if (!title || title === conversation.title || editMutation.isPending) {
      setIsEdit(false);
      return;
    }
    if (!userId) return;
    editMutation.mutate(title);
  }

  return (
    <List.Item
      onClick={() => openConversation(conversation.id)}
      onDoubleClick={startEdit}
      style={{
        cursor: streaming ? "not-allowed" : "pointer",
        padding: "12px 16px",
        background: isSelected ? "#e6f4ff" : undefined,
        opacity: streaming ? 0.5 : 1,
      }}
    >
      {isEdit ? (
        <Input
          autoFocus
          size="small"
          placeholder="请输入标题"
          value={newTitle}
          maxLength={128}
          disabled={editMutation.isPending}
          onChange={(event) => setNewTitle(event.target.value)}
          onPressEnter={submitEdit}
          // 编辑中点输入框不能冒泡成"打开会话"
          onClick={(event) => event.stopPropagation()}
          // 失焦或 Esc 取消编辑
          onBlur={() => setIsEdit(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setIsEdit(false);
          }}
        />
      ) : (
        <Typography.Text ellipsis strong={isSelected}>
          {conversation.title}
        </Typography.Text>
      )}
    </List.Item>
  );
}

export function AgentSession() {
  const streaming = useChatStore((s) => s.streaming);

  const { userId, userName, clearSession } = useAgentStore();
  const [, setConversationId] = useConversationId();
  const resetState = useChatStore((s) => s.resetState);

  const conversationsQuery = useQuery(userConversationsOptions(userId));

  const createMutation = useMutation({
    mutationFn: createConversation,
    onSuccess: (conversation) => {
      setConversationId(conversation.id);
      resetState();

      queryClient.invalidateQueries({
        queryKey: ["agent", "conversations", userId],
      });
    },
  });

  function handleNewConversation() {
    if (!userId) return;
    createMutation.mutate({ userId });
  }

  return (
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
            <AgentSessionItem
              key={conversation.id}
              conversation={conversation}
              streaming={streaming}
            />
          )}
        />
      </Flex>
    </Flex>
  );
}
