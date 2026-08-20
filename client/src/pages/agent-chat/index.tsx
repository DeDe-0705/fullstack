import { Layout } from "antd";
import { useState } from "react";
import { AgentInput } from "./components/Input";
import { AgentSession } from "./components/Session";
import { useAgentStore } from "@/stores/agent";
import { useConversationId } from "./hooks/useConversationId";
import { LoginComponent } from "./components/Login";
import { MessageComponent } from "./components/Messsage";
import { WelcomeComponent } from "./components/Welcome";

export default function AgentChat() {
  const { userId } = useAgentStore();
  const [conversationId] = useConversationId();

  // 会话栏宽度：localStorage 持久化，刷新后保持
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem("agent-sider-width"));
    return Number.isFinite(saved) && saved > 0 ? saved : 200;
  });

  function handleDragStart(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    // 拖拽期间禁止选中文字，否则鼠标划过内容区会选中文本
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    const onMove = (ev: MouseEvent) => {
      // 钳制在 160~400 之间，防止拖没或拖太宽
      setWidth(Math.min(400, Math.max(160, startWidth + ev.clientX - startX)));
    };

    const onUp = () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      setWidth((current) => {
        localStorage.setItem("agent-sider-width", String(current));
        return current;
      });
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  if (!userId) return <LoginComponent />;

  return (
    <Layout className="h-[calc(100vh-80px)] overflow-hidden gap-4">
      <Layout.Sider
        theme="light"
        width={width}
        className="shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
      >
        <AgentSession />
        {/* 拖拽把手：role=separator + 键盘方向键调宽度，满足无障碍要求 */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="调整会话栏宽度"
          tabIndex={0}
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400"
          onMouseDown={handleDragStart}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") setWidth((w) => Math.max(160, w - 16));
            if (event.key === "ArrowRight") setWidth((w) => Math.min(400, w + 16));
          }}
        />
      </Layout.Sider>
      <Layout.Content className="h-full flex flex-col items-stretch justify-center">
        {conversationId ? (
          <MessageComponent
            key={conversationId}
            conversationId={conversationId}
          ></MessageComponent>
        ) : (
          <WelcomeComponent />
        )}
        <AgentInput />
      </Layout.Content>
    </Layout>
  );
}
