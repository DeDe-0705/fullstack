import { Layout } from "antd";
import { useState } from "react";
import { AgentInput } from "./components/Input";
import { AgentSession } from "./components/Session";
import { useAgentStore } from "@/stores/agent";
import { useConversationId } from "./hooks/useConversationId";
import { LoginComponent } from "./components/Login";
import { MessageComponent } from "./components/Messsage";

export default function AgentChat() {
  const [collapsed, setCollapsed] = useState(false);
  const { userId } = useAgentStore();
  const [conversationId, setConversationId] = useConversationId();

  if (!userId) return <LoginComponent />;

  return (
    <Layout className="h-[calc(100vh-96px)] overflow-hidden gap-4">
      <Layout.Sider
        theme="light"
        width={200}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
      >
        <AgentSession />
      </Layout.Sider>
      <Layout.Content className="h-full flex flex-col items-stretch justify-center">
        {conversationId ? (
          <MessageComponent
            key={conversationId}
            conversationId={conversationId}
          ></MessageComponent>
        ) : (
          <div>需要会话id</div>
        )}
        <AgentInput />
      </Layout.Content>
    </Layout>
  );
}
