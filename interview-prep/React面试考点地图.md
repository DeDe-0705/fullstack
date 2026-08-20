# React 面试考点地图与标准

> 面向高级前端岗位的 React 面试「纲」。2025–2026 大厂趋势：从「考语法」转向「考原理 + 场景 + 性能优化」，从「会不会用」升级到「能不能解释为什么」。

---

## 一、大厂评判标准（高级前端分水岭）

1. **能讲清「为什么」，而不只是「是什么」**：Fiber 为什么引入、Hooks 为什么不能放条件里、合成事件为什么存在。
2. **性能优化能落地到具体场景和指标**：不是背「用 memo」，而是「这个页面首屏 3s，瓶颈在哪，怎么压到 1s」。
3. **能解释设计权衡**：useMemo 不是越多越好、受控 vs 非受控怎么选、状态放哪层。
4. **有工程化思维**：状态管理选型、代码组织、组件设计。
5. **场景题 + 追问**：这是通关密钥，单纯背八股过不了高级面。

---

## 二、分层考点地图（七层）

### 第 1 层：基础与正确使用（必过关，初级）

- JSX、组件、props、state、事件绑定
- 条件渲染、列表渲染与 `key` 的作用
- 受控组件 vs 非受控组件
- 组件设计：组合优于继承

### 第 2 层：渲染原理（中级 → 高级的分水岭）

- 虚拟 DOM 与 Diff 算法（为什么是性能优化「双刃剑」）
- Fiber 架构：为什么引入、可中断、时间切片
- render 阶段 vs commit 阶段
- setState 同步/异步、批处理（React 18 Automatic Batching）
- 合成事件与事件委托
- 类组件生命周期 → Hooks 生命周期

### 第 3 层：Hooks 机制（高级必考）

- useState / useEffect / useMemo / useCallback / useRef 底层
- 闭包陷阱（定时器/异步里拿到旧值）
- useEffect 执行时机、依赖数组、cleanup、StrictMode 双执行
- 为什么 Hooks 不能在条件语句里（链表 / Hook 顺序）
- 自定义 Hook 设计（警惕「上帝 Hook」）

### 第 4 层：性能优化（高级核心）

- React.memo、useMemo、useCallback 的正确姿势与滥用
- 虚拟列表、图片懒加载
- 代码分割：React.lazy + Suspense
- useDeferredValue、useTransition（解决卡顿）
- 列表 key、避免不必要 re-render

### 第 5 层：状态管理与数据请求（工程能力）

- Redux vs Zustand：客户端状态
- TanStack Query：服务端状态、useQuery/useMutation、缓存失效
- 服务端状态 vs 客户端状态的边界

### 第 6 层：React 19 新特性 + 前沿（2025–2026 加分项）

- **RSC（Server Components）**：字节一面已考
- Actions：useActionState / useFormStatus / useOptimistic
- `use` API、React Compiler
- 与 Vue3 的对比（响应式模型差异）

### 第 7 层：场景题与设计（高级决胜）

- 首屏性能优化：3s → 1s 的完整拆解（弱网、低端机）
- 大型应用架构：路由、状态、组件分层
- 组件/表单/列表的性能瓶颈定位

---

## 三、高频必考清单（背完再上考场）

| 考点 | 考察深度 |
| --- | --- |
| Fiber 架构 | 为什么引入、解决了什么、可中断协调 |
| Diff 算法 | 三个假设、key 的作用、为什么 O(n) |
| Hooks 底层 | 链表存储、为什么不能条件调用、闭包陷阱 |
| useEffect | 执行时机、依赖数组、cleanup、StrictMode 双执行 |
| setState | 同步/异步、批处理、函数式更新 |
| useMemo/useCallback | 正确使用、滥用问题、何时不用 |
| 性能优化 | 结合场景给方案，不是背清单 |
| 状态管理选型 | Redux/Zustand/Query 各自边界 |
| React 19 | RSC、Actions、useOptimistic |

---

## 四、自测清单（按「高级」标准）

- [ ] 我能不看资料，讲清「虚拟 DOM → Diff → Fiber」这条链路的每一步「为什么」
- [ ] 我能解释 Hooks 为什么是链表、为什么不能放条件语句
- [ ] 我能说清 useEffect 的完整执行时机（含 cleanup、StrictMode）
- [ ] 我能对一个真实页面做性能优化，并说出指标（LCP/FCP/CLS）变化
- [ ] 我能解释「useMemo 不是越多越好」背后的 trade-off
- [ ] 我能说清 RSC 解决什么问题、和传统 CSR 的区别
- [ ] 我能答好一道 React 场景题 + 至少两层追问

---

## 来源

- 2026 大厂 React 面试五大模块（字节/阿里/滴滴）：https://www.mianlingai.com/blog/react-interview-ai-guide-2026/
- React 高频面试题（暑期实习真实面经，渲染机制/Hooks/useEffect/性能优化）：https://www.yuque.com/guluguluwater-qkq0t/qbbqks/vwyuwvf3al8k58x6
- 2025 大厂前端面经（RSC 原理、性能优化方案）：https://juejin.cn/post/7569810118168690703
- React 高频考点与源码深度解析：https://my.oschina.net/emacs_7998362/blog/19447904
