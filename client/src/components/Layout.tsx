import { Layout as AntLayout, Menu } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  { key: "/", label: "首页" },
  { key: "/posts", label: "帖子" },
  { key: "/about", label: "关于" },
  { key: "/agent", label: "Agent 对话" },
  {
    key: "/learn",
    label: "React 学习",
    children: [
      { key: "/learn/hooks-closure", label: "Hooks 闭包与 setState" },
      { key: "/learn/use-effect", label: "useEffect 生命周期" },
      { key: "/learn/custom-hooks", label: "自定义 Hook 设计" },
      { key: "/learn/render-optimization", label: "渲染优化" },
      { key: "/learn/react-19", label: "React 19 新特性" },
    ],
  },
];

export function Layout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // 子路由（如 /posts/1）时也高亮对应的一级菜单
  const selectedKey = pathname === "/" ? "/" : `/${pathname.split("/")[1]}`;

  return (
    <AntLayout style={{ minHeight: "100vh" }}>
      <AntLayout.Header
        style={{
          background: "#fff",
          borderBottom: "1px solid #f0f0f0",
          paddingInline: 24,
        }}
      >
        <Menu
          mode="horizontal"
          selectedKeys={[selectedKey]}
          items={NAV_ITEMS}
          onClick={({ key }) => navigate(key)}
          style={{ lineHeight: "63px", borderBottom: "none" }}
        />
      </AntLayout.Header>
      <AntLayout.Content
        style={{
          padding: 8,
          boxSizing: "border-box",
        }}
      >
        <Outlet />
      </AntLayout.Content>
    </AntLayout>
  );
}
