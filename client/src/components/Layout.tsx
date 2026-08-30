import { Suspense, useMemo } from "react";
import { Layout as AntLayout, Menu, Spin } from "antd";
import { Outlet, useMatches, useNavigate } from "react-router-dom";
import { getMenuItems, type MenuMeta } from "../lib/menu";
import { routes } from "../router/routes";

export function Layout() {
  const navigate = useNavigate();
  const matches = useMatches();

  // 菜单由路由配置自动生成，避免在 Layout 里再手写一份 path
  const menuItems = useMemo(() => getMenuItems(routes), []);

  // 详情页（如 /posts/1）本身不在菜单里，回退到最近一个有 menu 的父级高亮
  const selectedMatch = [...matches]
    .reverse()
    .find((match) => (match.handle as { menu?: MenuMeta } | undefined)?.menu);
  const selectedKey = selectedMatch?.pathname ?? "/";

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
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ lineHeight: "63px", borderBottom: "none" }}
        />
      </AntLayout.Header>
      <AntLayout.Content style={{ padding: 8, boxSizing: "border-box" }}>
        <Suspense
          fallback={
            <Spin
              style={{ display: "block", margin: "40px auto" }}
              tip="页面加载中..."
            />
          }
        >
          <Outlet />
        </Suspense>
      </AntLayout.Content>
    </AntLayout>
  );
}
