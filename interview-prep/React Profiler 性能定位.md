# React Profiler 性能定位

> 性能优化第一原则：**先测量，再优化**。React DevTools 的 Profiler 就是测量工具——它告诉你「哪些组件渲染了、渲染多久、为什么渲染」，而不是靠猜。

## 一、Profiler 采集什么数据

React DevTools 的 Profiler 面板，会在每次 **commit（DOM 更新提交）** 后采集：

- 每个组件的**渲染耗时**；
- 组件的**渲染原因**（props / state / context 变化）；
- 实际渲染与「本可以跳过」的差异；
- 本次 commit 的**总耗时**和**交互来源**。

## 二、三个核心视图

### 2.1 Flamegraph（火焰图）

- 每个**横条 = 一个组件**，从上到下是组件树的层级；
- **横条越宽 = 渲染耗时越长**；
- 根节点是触发本次更新的组件，叶子是子组件。

用途：快速看到「哪一条渲染链路最耗时」，以及是「某个组件本身慢」还是「它的子树慢」。

### 2.2 Ranked（排行榜）—— 找真正慢的组件

按渲染耗时**排序**，列出最慢的组件。

关键概念：**self time（自身耗时）vs total time（总耗时）**：

- `total time`：组件 + 它的所有子组件的总耗时；
- `self time`：组件自身逻辑的耗时（不含子组件）。

**Ranked 视图要按 self time 看**——因为一个组件 total time 大，可能只是被子组件拖慢，真正慢的「元凶」是 self time 高的那个。

### 2.3 组件树 / Why did this render

选中某个组件，Profiler 会显示它**为什么重新渲染**：

- 是 props 变了？
- 是自身 state 变了？
- 还是 context 变了？

这决定了你的优化手段：props 引用不稳定 → `useCallback/useMemo`；context 值频繁变 → 拆分 context 或状态局部化。

## 三、关键指标

- **渲染耗时 > 16ms**：超过 60fps 一帧的预算，会造成掉帧；
- **commit 次数**：同一次交互触发了多少次 commit（多次 = 批处理没生效或状态设计有问题）；
- **无意义的 re-render**：组件在 props/state 都没变时仍重新渲染。

## 四、定位流程（四步法，面试按这个答）

```
① 测量：打开 Profiler → 录制 → 复现卡顿操作 → 停止
② 找慢组件：Ranked 视图按 self time 排序，定位耗时最长的组件
③ 分析原因：Why did this render 看它是 props/state/context 哪种变化触发
④ 验证：针对性优化后重新 profile，对比优化前后的耗时
```

**先测量再优化的价值**：避免「以为某处慢，优化了半天其实不是瓶颈」。

## 五、代码里的 `<Profiler>` 用法

不方便用 DevTools 面板时，可以在代码里用 `<Profiler>` 包裹目标组件：

```jsx
import { Profiler } from 'react'

function onRenderCallback(
  id,            // Profiler 的 id
  phase,         // "mount" / "update"
  actualDuration, // 本次渲染实际耗时
  baseDuration,  // 无优化情况下的预估耗时
  startTime,
  commitTime,
) {
  console.log({ id, phase, actualDuration })
}

<Profiler id="List" onRender={onRenderCallback}>
  <List />
</Profiler>
```

注意：`phase` 为 `"update"` 且 `actualDuration` 明显大于 `baseDuration`，说明渲染被某种因素拖慢了，值得排查。

## 六、配合 Chrome Performance 面板

Profiler 告诉你「**是什么慢**」，Chrome Performance 告诉你「**为什么慢**」：

```
React Profiler → 定位重渲染/慢组件
Why did this render → 分析触发原因
Chrome Performance → 看 JS 执行、Layout/Paint/Composite，验证浏览器层的瓶颈
```

如果 Profiler 显示组件很快，但页面仍卡，问题可能在浏览器层（大量 Layout/Paint、长任务、GC），这时用 Chrome Performance 面板抓火焰图看 `Main` 线程。

## 七、常见性能问题的定位思路

| 现象 | Profiler 看到的 | 优化方向 |
| --- | --- | --- |
| 父组件一动，整棵子树全渲染 | 大量组件 actualDuration 很小但都重渲染 | React.memo + useCallback/useMemo |
| 某个组件渲染巨慢 | Ranked 里 self time 很高 | 拆分组件、useMemo 缓存重计算 |
| 同一次交互 commit 多次 | commit 次数多 | 检查批处理 / 状态设计 |
| 输入一个字符整页卡 | 每次输入都全量渲染 + 重计算 | useDeferredValue / useTransition + 虚拟列表 |

## 八、面试话术

> 性能定位我会先测量再优化：用 React DevTools Profiler 录制卡顿操作，Ranked 视图按 self time 找最慢的组件，再用 Why did this render 分析它是因为 props/state/context 哪种变化重渲染；优化后重新 profile 对比耗时。如果 Profiler 显示组件很快但页面仍卡，就切到 Chrome Performance 面板，看是不是浏览器层的 Layout/Paint 或长任务瓶颈。关键是 self time 和 total time 要分清，避免把「被子组件拖慢」误判成「组件本身慢」。

## 来源（2026 检索）

- [React 性能工具链：React DevTools Profiler 与 Chrome Performance 的协同分析](https://blog.csdn.net/qq_34803115/article/details/162783285)
- [Measuring Performance with Real Tools — Steve Kinney](https://stevekinney.com/courses/react-performance/measuring-performance-with-real-tools)
- [Fixing React Performance at Scale: A Senior Engineer's Practical Playbook](https://dev.to/mooh/fixing-react-performance-at-scale-a-senior-engineers-practical-playbook-ceg)
- [React 性能优化实战：Profiler 定位瓶颈](https://fridolph.github.io/FE-prepare-interview/面试官问/08react/q_react_3-performance.html)
