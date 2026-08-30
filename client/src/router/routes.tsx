import { Layout } from "../components/Layout";
import { Home } from "../pages/Home";
import {
  About,
  AgentChat,
  CartPage,
  CEndLayout,
  CheckoutPage,
  CustomHooks,
  FeedPage,
  FixedVirtualList,
  HooksClosure,
  MultiStepForm,
  NotFound,
  PostDetail,
  Posts,
  ProductDetail,
  ProductList,
  React19Features,
  ReduxDemo,
  RenderOptimization,
  SearchPage,
  ShopLayout,
  UGC,
  UseEffectLifecycle,
  VariableVirtualList,
} from "./lazyPages";
import { queryClient } from "../lib/queryClient";
import { postDetailOptions } from "../lib/posts";
import { productDetailOptions } from "../features/shop/queries";
import type { RouteObject } from "react-router-dom";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        handle: { menu: { label: "首页" } },
        element: <Home />,
      },
      {
        path: "posts",
        handle: { menu: { label: "帖子" } },
        element: <Posts />,
      },
      {
        path: "posts/:id",
        // loader 在路由跳转时预取数据：组件渲染前数据已进入缓存，避免瀑布请求
        // （React Router Data API 与 TanStack Query 结合的主流模式，面试加分项）
        loader: ({ params }) =>
          queryClient.ensureQueryData(postDetailOptions(Number(params.id))),
        element: <PostDetail />,
      },
      {
        path: "about",
        handle: { menu: { label: "关于" } },
        element: <About />,
      },
      {
        path: "agent",
        handle: { menu: { label: "Agent 对话" } },
        element: <AgentChat />,
      },
      { path: "agent/:id", element: <AgentChat /> },
      {
        path: "learn",
        handle: { menu: { label: "React 学习" } },
        children: [
          {
            path: "hooks-closure",
            handle: { menu: { label: "Hooks 闭包与 setState" } },
            element: <HooksClosure />,
          },
          {
            path: "use-effect",
            handle: { menu: { label: "useEffect 生命周期" } },
            element: <UseEffectLifecycle />,
          },
          {
            path: "custom-hooks",
            handle: { menu: { label: "自定义 Hook 设计" } },
            element: <CustomHooks />,
          },
          {
            path: "render-optimization",
            handle: { menu: { label: "渲染优化" } },
            element: <RenderOptimization />,
          },
          {
            path: "react-19",
            handle: { menu: { label: "React 19 新特性" } },
            element: <React19Features />,
          },
          {
            path: "fixed-virtual-list",
            handle: { menu: { label: "定高虚拟滚动" } },
            element: <FixedVirtualList />,
          },
          {
            path: "variable-virtual-list",
            handle: { menu: { label: "不定高虚拟滚动" } },
            element: <VariableVirtualList />,
          },
        ],
      },
      {
        path: "shop",
        handle: { menu: { label: "Shop 场景实战" } },
        element: <ShopLayout />,
        children: [
          { index: true, element: <ProductList /> },
          {
            path: "product/:id",
            // Router loader 预取 + TanStack Query 缓存结合：
            // 进入详情页前先确保数据已进缓存，组件渲染时 useQuery 直接命中，避免 loading 闪烁
            loader: ({ params }) =>
              queryClient.ensureQueryData(
                productDetailOptions(Number(params.id)),
              ),
            element: <ProductDetail />,
          },
          { path: "cart", element: <CartPage /> },
          { path: "checkout", element: <CheckoutPage /> },
        ],
      },
      {
        path: "c-end",
        handle: { menu: { label: "C端场景实战" } },
        element: <CEndLayout />,
        children: [
          { index: true, element: <SearchPage /> },
          { path: "search", element: <SearchPage /> },
          { path: "feed", element: <FeedPage /> },
        ],
      },
      {
        path: "multi-step-form",
        handle: { menu: { label: "多步骤表单" } },
        element: <MultiStepForm />,
      },
      {
        path: "redux-demo",
        handle: { menu: { label: "Redux 用法" } },
        element: <ReduxDemo />,
      },
      {
        path: "ugc",
        element: <UGC />,
        handle: { menu: { label: "UGC" } },
      },
      { path: "*", element: <NotFound /> },
    ],
  },
];
