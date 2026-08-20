import { createConversation, userConversationsOptions } from "@/lib/agent";
import { queryClient } from "@/lib/queryClient";
import { useAgentStore } from "@/stores/agent";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useConversationId } from "../hooks/useConversationId";
import { LogoutOutlined, PlusOutlined } from "@ant-design/icons";
import { Flex, Typography, Button, List, Empty } from "antd";
import { useMemo } from "react";
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
  const isSelected = useMemo(
    () => conversationId === conversation.id,
    [conversation, conversationId],
  );

  const resetState = useChatStore((s) => s.resetState);

  function openConversation(id: string) {
    // 会话 ID 进 URL：刷新或分享链接都能直接回到该会话
    setConversationId(id);
    resetState();
  }

  return (
    <List.Item
      onClick={() => openConversation(conversation.id)}
      style={{
        cursor: streaming ? "not-allowed" : "pointer",
        padding: "12px 16px",
        background: isSelected ? "#e6f4ff" : undefined,
        opacity: streaming ? 0.5 : 1,
      }}
    >
      <Typography.Text ellipsis strong={isSelected}>
        {conversation.title}
      </Typography.Text>
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
            ></AgentSessionItem>
          )}
        />
      </Flex>
    </Flex>
  );
}
