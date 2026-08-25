import { createBrowserRouter } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Home } from "../pages/Home";
import { About } from "../pages/About";
import { Posts } from "../pages/Posts";
import { PostDetail } from "../pages/PostDetail";
import AgentChat from "@/pages/agent-chat";
import { NotFound } from "../pages/NotFound";
import { HooksClosure } from "../pages/learn/HooksClosure";
import { UseEffectLifecycle } from "../pages/learn/UseEffectLifecycle";
import { CustomHooks } from "../pages/learn/CustomHooks";
import { RenderOptimization } from "../pages/learn/RenderOptimization";
import { React19Features } from "../pages/learn/React19Features";
import { FixedVirtualList } from "../pages/learn/FixedVirtualList";
import { queryClient } from "../lib/queryClient";
import { postDetailOptions } from "../lib/posts";
import { ShopLayout } from "../features/shop/ShopLayout";
import { ProductList } from "../features/shop/ProductList";
import { ProductDetail } from "../features/shop/ProductDetail";
import { CartPage } from "../features/shop/CartPage";
import { CheckoutPage } from "../features/shop/CheckoutPage";
import { productDetailOptions } from "../features/shop/queries";
import { CEndLayout } from "../features/cend/CEndLayout";
import { SearchPage } from "../features/cend/SearchPage";
import { FeedPage } from "../features/cend/FeedPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: "posts", element: <Posts /> },
      {
        path: "posts/:id",
        // loader 在路由跳转时预取数据：组件渲染前数据已进入缓存，避免瀑布请求
        // （React Router Data API 与 TanStack Query 结合的主流模式，面试加分项）
        loader: ({ params }) =>
          queryClient.ensureQueryData(postDetailOptions(Number(params.id))),
        element: <PostDetail />,
      },
      { path: "about", element: <About /> },
      { path: "agent", element: <AgentChat /> },
      { path: "agent/:id", element: <AgentChat /> },
      { path: "learn/hooks-closure", element: <HooksClosure /> },
      { path: "learn/use-effect", element: <UseEffectLifecycle /> },
      { path: "learn/custom-hooks", element: <CustomHooks /> },
      { path: "learn/render-optimization", element: <RenderOptimization /> },
      { path: "learn/react-19", element: <React19Features /> },
      { path: "learn/fixed-virtual-list", element: <FixedVirtualList /> },
      {
        path: "shop",
        element: <ShopLayout />,
        children: [
          { index: true, element: <ProductList /> },
          {
            path: "product/:id",
            // Router loader 预取 + TanStack Query 缓存结合：
            // 进入详情页前先确保数据已进缓存，组件渲染时 useQuery 直接命中，避免 loading 闪烁
            loader: ({ params }) =>
              queryClient.ensureQueryData(productDetailOptions(Number(params.id))),
            element: <ProductDetail />,
          },
          { path: "cart", element: <CartPage /> },
          { path: "checkout", element: <CheckoutPage /> },
        ],
      },
      {
        path: "c-end",
        element: <CEndLayout />,
        children: [
          { index: true, element: <SearchPage /> },
          { path: "search", element: <SearchPage /> },
          { path: "feed", element: <FeedPage /> },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
