import type { MenuProps } from "antd";
import type { RouteObject } from "react-router-dom";

type MenuItems = NonNullable<MenuProps["items"]>;

export type MenuMeta = {
  label: string;
  hideInMenu?: boolean;
};

// 只把 children 和 handle 收窄成菜单推导需要的类型，其余字段沿用 RouteObject
type MenuRoute = Omit<RouteObject, "children"> & {
  handle?: { menu?: MenuMeta };
  children?: MenuRoute[];
};

function joinPaths(parent: string, path?: string): string {
  if (!path) return parent || "/";
  if (path.startsWith("/")) return path;
  return `${parent}/${path}`.replace(/\/+/g, "/");
}

function buildMenuItems(
  routes: MenuRoute[],
  parentPath = "/",
): MenuItems {
  const items: MenuItems = [];

  for (const route of routes) {
    const meta = route.handle?.menu;
    if (!meta || meta.hideInMenu) continue;

    const key = joinPaths(parentPath, route.path);
    const children = route.children
      ? buildMenuItems(route.children, key)
      : [];

    items.push({
      key,
      label: meta.label,
      children: children.length ? children : undefined,
    });
  }

  return items;
}

export function getMenuItems(routes: RouteObject[]): MenuItems {
  const root = routes[0] as unknown as MenuRoute | undefined;
  return buildMenuItems(root?.children ?? [], root?.path ?? "/");
}
