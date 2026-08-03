import { App as AntdApp } from "antd";
import type { ComponentType, CSSProperties } from "react";
import WujieReact from "wujie-react";
import type { SubAppConfig } from "../config/subApps";
import { useAuthStore } from "../stores/authStore";

interface WujieReactProps {
  name: string;
  url: string;
  alive?: boolean;
  sync?: boolean;
  width?: string;
  height?: string;
  style?: CSSProperties;
  props?: Record<string, unknown>;
  loadError?: (url: string, error: unknown) => void;
}

// 两个坑都收敛在这里：
// 1. wujie-react 官方 d.ts 没给泛型 props，本地收窄一次；
// 2. loading 不要传 React element——wujie core 期望 HTMLElement，否则 appendChild 直接 TypeError。
const Wujie = WujieReact as unknown as ComponentType<WujieReactProps>;

export default function WujieContainer({ app }: { app: SubAppConfig }) {
  const { token, user } = useAuthStore();
  const { message } = AntdApp.useApp();

  return (
    <div className="h-[calc(100vh-112px)] w-full overflow-hidden rounded-lg border border-gray-200 bg-white">
      <Wujie
        name={app.name}
        url={app.url}
        alive={app.alive}
        sync
        width="100%"
        height="100%"
        props={{ token, user, hostBasePath: app.path }}
        loadError={(url, error) => {
          console.error("[wujie] loadError", url, error);
          message.error(`子应用加载失败：${url}`);
        }}
      />
    </div>
  );
}
