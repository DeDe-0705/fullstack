# micro-host

微前端父应用实战：React 19 + TypeScript + Vite + antd v6 + Tailwind v4 + React Router v7 + Zustand + wujie-react。

当前已接入一个本地联调子应用：`ui-kit` showcase，入口 `http://localhost:5173/`，host 路由 `/micro/ui-kit/*`。其余子应用仍是 planned 占位。

```bash
pnpm install
pnpm dev      # http://localhost:5180
pnpm build
pnpm lint
pnpm typecheck
```

路由约定：`/micro/:name/*` 是子应用容器入口；子应用 URL 后续通过 `VITE_SUB_*` 环境变量注入。
