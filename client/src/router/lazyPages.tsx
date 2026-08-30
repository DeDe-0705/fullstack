import { lazy } from "react";

// 路由级懒加载的页面组件统一放这里，保持 routes.tsx 只负责配置

export const AgentChat = lazy(() => import("@/pages/agent-chat"));

export const About = lazy(() =>
  import("../pages/About").then((m) => ({ default: m.About })),
);

export const Posts = lazy(() =>
  import("../pages/Posts").then((m) => ({ default: m.Posts })),
);

export const PostDetail = lazy(() =>
  import("../pages/PostDetail").then((m) => ({ default: m.PostDetail })),
);

export const NotFound = lazy(() =>
  import("../pages/NotFound").then((m) => ({ default: m.NotFound })),
);

export const HooksClosure = lazy(() =>
  import("../pages/learn/HooksClosure").then((m) => ({ default: m.HooksClosure })),
);

export const UseEffectLifecycle = lazy(() =>
  import("../pages/learn/UseEffectLifecycle").then((m) => ({ default: m.UseEffectLifecycle })),
);

export const CustomHooks = lazy(() =>
  import("../pages/learn/CustomHooks").then((m) => ({ default: m.CustomHooks })),
);

export const RenderOptimization = lazy(() =>
  import("../pages/learn/RenderOptimization").then((m) => ({ default: m.RenderOptimization })),
);

export const React19Features = lazy(() =>
  import("../pages/learn/React19Features").then((m) => ({ default: m.React19Features })),
);

export const FixedVirtualList = lazy(() =>
  import("../pages/learn/FixedVirtualList").then((m) => ({ default: m.FixedVirtualList })),
);

export const VariableVirtualList = lazy(() =>
  import("../pages/learn/VariableVirtualList").then((m) => ({ default: m.VariableVirtualList })),
);

export const ShopLayout = lazy(() =>
  import("../features/shop/ShopLayout").then((m) => ({ default: m.ShopLayout })),
);

export const ProductList = lazy(() =>
  import("../features/shop/ProductList").then((m) => ({ default: m.ProductList })),
);

export const ProductDetail = lazy(() =>
  import("../features/shop/ProductDetail").then((m) => ({ default: m.ProductDetail })),
);

export const CartPage = lazy(() =>
  import("../features/shop/CartPage").then((m) => ({ default: m.CartPage })),
);

export const CheckoutPage = lazy(() =>
  import("../features/shop/CheckoutPage").then((m) => ({ default: m.CheckoutPage })),
);

export const CEndLayout = lazy(() =>
  import("../features/cend/CEndLayout").then((m) => ({ default: m.CEndLayout })),
);

export const SearchPage = lazy(() =>
  import("../features/cend/SearchPage").then((m) => ({ default: m.SearchPage })),
);

export const FeedPage = lazy(() =>
  import("../features/cend/FeedPage").then((m) => ({ default: m.FeedPage })),
);

export const MultiStepForm = lazy(() =>
  import("../features/multi-step-form/MultiStepForm").then((m) => ({ default: m.MultiStepForm })),
);

export const ReduxDemo = lazy(() =>
  import("../features/redux-demo/ReduxDemo").then((m) => ({ default: m.ReduxDemo })),
);

export const UGC = lazy(() =>
  import("@/pages/UGC/index").then((m) => ({ default: m.UGC })),
);
