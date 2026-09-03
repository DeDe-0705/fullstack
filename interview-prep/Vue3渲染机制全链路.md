# Vue3 渲染机制全链路：依赖收集 → 编译优化 → 靶向更新

> 高频连环问链路：「依赖收集收集的是什么？」→「编译优化做了哪些事？」→「数据变化后页面怎么更新的？」
> 本文把三轮问答串成一条完整链路，细节深挖见 [Vue3深度原理](./Vue3深度原理.md)。

---

## 零、一张图看懂三层架构

```
┌─────────────────────────────────────────────────────────┐
│ 编译层（build 时跑一次）                                   │
│ template → parse → transform → generate → render 函数    │
│ 固化进代码的优化：静态提升 / patchFlag / 预字符串化         │
│              / 事件缓存 / openBlock block 结构            │
└─────────────────────────────────────────────────────────┘
                          ↓ 产出 render 函数
┌─────────────────────────────────────────────────────────┐
│ 响应式层（runtime）                                       │
│ get → track 收集 activeEffect（依赖收集）                 │
│ set → trigger 找到 effect 集合 → 调度执行                 │
│ 数据结构：targetMap = WeakMap<target, Map<key, Set<effect>>> │
└─────────────────────────────────────────────────────────┘
                          ↓ effect 执行
┌─────────────────────────────────────────────────────────┐
│ 渲染层（runtime）                                         │
│ 执行 render 函数 → 构建 block tree（dynamicChildren）     │
│ patch(n1, n2) → patchBlockChildren 只 diff 动态节点       │
│ → 按 patchFlag 靶向更新真实 DOM                          │
└─────────────────────────────────────────────────────────┘
```

**分层心智模型（面试加分项）**：两套机制互相正交——

- **响应式管粒度**：数据变了，哪些组件需要重渲染（组件级更新，天然不需要 memo）
- **编译优化管速度**：组件重渲染时，diff 的范围有多小（跳过静态、靶向动态）

---

## 一、依赖收集：收集的是 effect，不是 render

### 1.1 核心结论

依赖收集收集的是**当前正在执行的副作用函数**（`ReactiveEffect` 实例），源码中即 `activeEffect`。render 不是被收集的对象，它只是 effect 的一种使用场景。

### 1.2 最小实现

```js
let activeEffect

class ReactiveEffect {
  constructor(public fn) {}
  run() {
    activeEffect = this   // 标记当前活跃副作用
    const result = this.fn() // 执行中触发 get → track
    activeEffect = null
    return result
  }
}

// targetMap: WeakMap<target, Map<key, Set<effect>>>
function track(target, key) {
  let depsMap = targetMap.get(target)
  if (!depsMap) targetMap.set(target, (depsMap = new Map()))
  let dep = depsMap.get(key)
  if (!dep) depsMap.set(key, (dep = new Set()))
  dep.add(activeEffect)   // 收集的就是当前 effect
}
```

存储结构是三层：**对象 → 属性 key → 依赖该属性的 effect 集合（Set）**。用 Set 天然去重。

### 1.3 render / watch / computed 与 effect 的关系

它们都是**创建 effect 的来源**，不是被收集的对象：

| API | 与 effect 的关系 |
|---|---|
| render | 组件挂载时渲染函数被包成渲染 effect，重渲染 = 重跑这个 effect |
| watch | 带自定义 `scheduler` 的 effect，依赖变化时走 scheduler 调回调而非直接重跑 |
| computed | 双重身份：既收集自己 getter 的依赖，又作为响应式值被 render 等其他 effect 收集 |

### 1.4 收集时机与 cleanup（追问点）

- 依赖收集发生在 **effect 执行过程中触发 get 的那一刻**，是运行时动态行为，不是编译期静态分析
- 由此引出两个行为：
  - **动态依赖**：if 分支没访问到的属性不会被收集，条件变了才收集新依赖
  - **cleanupEffect**：每次重跑前清空旧依赖再重新收集，避免脏依赖导致多余更新

---

## 二、编译优化：编译一次，执行多次

### 2.1 五项优化清单

| 优化 | 做什么 | 收益 |
|---|---|---|
| **patchFlag** | 静态分析后给动态节点打标（TEXT=1 / CLASS=2 / STYLE=4 / PROPS=8 ...） | diff 时单节点靶向更新，不比全量 props |
| **静态提升** | 纯静态节点提升到 render 函数外（`_hoisted_N`） | 只创建一次 vnode，更新时引用相同直接跳过 diff |
| **预字符串化** | 连续静态节点超阈值（默认 20 个）→ 整段 HTML 字符串 | `createStaticVNode` + `innerHTML` 一次挂载，连 vnode 都不建 |
| **事件缓存** | `onClick: _cache[0] \|\| (_cache[0] = ...)` | 避免每次 render 生成新函数导致 props 变化误判 |
| **Block 结构** | 生成代码中插入 `openBlock()` / `createElementBlock()` | 为运行时构建 block tree 埋点 |

### 2.2 关键澄清：block tree 不是编译器"生成"的

**易错点**：编译器做的是在 render 代码里**埋入 block 结构标记**；block tree 是 **runtime 执行 render 函数时**才真正构建的——执行中遇到动态节点就收集进当前 block 的 `dynamicChildren` 数组。

准确表述：

> 编译器通过代码生成把 block 结构"埋"进 render 函数，block tree 在运行时构建。

### 2.3 编译产物的样子

```js
import { openBlock, createElementBlock, createElementVNode, toDisplayString } from 'vue'

const _hoisted_1 = /*#__PURE__*/ createElementVNode("span", null, "静态文本", -1 /* HOISTED */)

export function render(_ctx, _cache) {
  return (openBlock(), createElementBlock("div", null, [
    _hoisted_1,  // 静态提升，引用恒定，diff 直接跳过
    createElementVNode("span", null, toDisplayString(_ctx.dynamic), 1 /* TEXT */)
    //                     ↑ 动态节点进入 dynamicChildren   ↑ patchFlag
  ]))
}
```

---

## 三、运行时更新：数据变化 → DOM 更新的完整链路

### 3.1 六步流水线

1. **trigger**：响应式 `set` 拦截，从 `targetMap` 找到该 key 的 effect 集合
2. **调度**：组件渲染 effect 带 `scheduler`，job 进**微任务队列**（`queueJob` + `Promise.resolve().then(flushJobs)`）→ 同步多次改数据只重渲染一次，这就是 `nextTick` 要等的原因
3. **执行 render 函数**：执行的是**编译期已生成好的 render 函数**（编译只跑一次），参数是最新状态；执行中重建 block tree，收集新的 `dynamicChildren`
4. **patch 对比**：`patch(n1, n2)`，n1 是旧 subTree；静态提升节点 n1、n2 引用相同，直接跳过
5. **patchBlockChildren**：只 diff 拍平的 `dynamicChildren` 列表，**不递归整棵树**——block tree 的意义就是跳过静态子树
6. **靶向更新**：单个动态节点按 patchFlag 精准操作 DOM（TEXT 只改文本、CLASS 只改 class），变更落盘

### 3.2 两个易错点

**① 更新粒度是组件级，不是页面级**

effect 触发的是**该组件自己的渲染 effect**，只有该组件的 subtree 重新生成 vnode 并 diff。依赖收集天然把更新圈在组件边界内——这是 Vue3 不需要像 React 那样到处 memo 的根本原因。

**② "基于 compiler 的结果对比"表述错误**

编译是 build 时一次性的事，产出 render 函数后，每次重渲染执行的都是**同一份编译产物**。不存在"每次更新都基于编译结果再做处理"。正确的心智模型：

> 编译一次，执行多次。优化信息（block、patchFlag、静态提升）固化在 render 函数代码里，每次重渲染"免费"生效。

### 3.3 diff 的完整职责（不止增删移）

- **新旧 vnode 来源**：新树 = 本次 render 产物（`n2`）；旧树 = 组件实例的 `instance.subTree`（上次 render 产物，`n1`），每个 vnode 挂 `el` 指向真实 DOM。首次挂载 `n1 = null`，不走 diff 直接 mount
- **同节点判定**：`isSameVNodeType` 比 `type + key`，不同 → 卸载旧 + 挂载新，不做子树对比
- **复用**：同节点复用真实 DOM（`n2.el = n1.el`），组件复用实例——复用是 diff 的最大价值
- **更新**：`patchProps` 按 patchFlag 靶向更新；事件用 invoker 机制换绑（不 removeEventListener）
- **组件分流**：子组件 vnode 走 `updateComponent` 闸门（见第五节）
- **卸载副作用**：`beforeUnmount`/`unmounted` 生命周期、指令钩子、ref 解绑、事件移除、transition 离场动画播完才移除 DOM
- **挂载副作用**：创建 DOM、绑事件、设 ref、`mounted`、anchor 定位插入
- **移动最小化**：keyed children 乱序用最长递增子序列（LIS）算出无需移动的节点，压到最少 DOM 移动次数
- **静态跳过**：静态提升节点新旧引用相同，直接略过

一句话：**diff 的目标是"最少 DOM 操作"，增删移只是 children 对比的三个分支，复用与靶向更新才是大头。**


---

## 四、Block 嵌套结构（追问高发区）

### 4.1 Block ≠ Fragment

Block 是一种**角色**（"收集了 dynamicChildren 的 vnode"），不是一种 vnode 类型：

- 组件 render 根：`openBlock()` + `createElementBlock("div", ...)` → 根元素本身就是 block
- 只有多根模板、`v-for` 列表、`v-if/else` 分支等"无单一宿主元素"的场景，才由 **Fragment vnode 充当 block**

### 4.2 两种颗粒度别混淆

| 颗粒度 | 由什么决定 | 作用 |
|---|---|---|
| **重渲染颗粒度 = 组件** | 响应式层（每组件一个渲染 effect） | 数据变了只重跑该组件的 render |
| **block 嵌套颗粒度 = 模板内部结构** | 结构指令（v-if 分支 / v-for 列表） | 决定组件内部 diff 的跳过范围 |

组件边界**切分** block tree（子组件有自己的 block tree 根，各自更新），但 block tree 的嵌套与组件边界无关。

### 4.3 嵌套结构实例

`dynamicChildren` 里存两类条目：**带 patchFlag 的动态叶子节点** 和 **嵌套子 block**：

```
Block(div)                                    ← 组件 render 根（元素 block）
└─ dynamicChildren:
   ├─ VNode(p, TEXT)                          ← 动态叶子，按 flag 靶向更新
   ├─ Block(Fragment, KEYED_FRAGMENT)         ← v-for 独立子 block，key + LIS diff
   └─ Block(v-if 分支)                         ← 每个分支独立成 block
```

diff 行为：

- 父 block 的 `patchBlockChildren` 只遍历 `dynamicChildren`，静态节点在每一层都被跳过
- v-for 子 block → 递归进去走 keyed fragment diff（双端比较 + 最长递增子序列）
- v-if 分支切换 → 整个子 block 直接卸载/挂载（**不做跨分支 diff**，这正是分支独立成 block 的原因）；分支不变则递归进该分支继续拍平 diff
- 嵌套层级以此类推——block tree 就是"block 套 block"的树

---

## 五、父子组件更新边界：shouldUpdateComponent

### 5.1 问题：父组件重渲染，子组件一定跟着重渲染吗？

不一定。父 block 的 `dynamicChildren` 里，元素节点直接递归 diff；**组件 vnode 则切换到组件级逻辑**——这正是「block ≠ 组件」的实际意义。

### 5.2 updateComponent：实例复用 + 闸门判断

```js
// runtime-core/src/renderer.ts（简化）
const updateComponent = (n1, n2) => {
  const instance = (n2.component = n1.component)  // 实例复用，子组件从不重建

  if (shouldUpdateComponent(n1, n2)) {
    instance.next = n2      // 新 vnode 暂存到 next
    instance.update()       // 触发子组件渲染 effect（进调度队列）
  } else {
    n2.el = n1.el           // 闸门关闭：只同步引用
    instance.vnode = n2     // 子组件 render 一次都不跑
  }
}
```

### 5.3 shouldUpdateComponent 判定顺序

```js
// runtime-core/src/componentRenderUtils.ts（简化）
function shouldUpdateComponent(n1, n2) {
  if (n2.dirs || n2.transition) return true        // ① 指令/transition → 更新
  if (patchFlag & DYNAMIC_SLOTS) return true       // ② 动态插槽 → 更新
  if (patchFlag & FULL_PROPS)                      // ③ v-bind="obj" 类不确定 props → 全量浅比较
    return hasPropsChanged(prevProps, nextProps, emits)
  if (patchFlag & PROPS) {                         // ④ 最常见：只比 dynamicProps 列出的 key
    for (const key of n2.dynamicProps) {
      if (nextProps[key] !== prevProps[key] && !isEmitListener(emits, key))
        return true
    }
  }
  return false
}
```

**这又是编译优化的体现**：静态 props 不参与比较；动态 props 编译期收进 `dynamicProps`，更新时只浅比较这几个 key；`onXxx` 事件被 `isEmitListener` 排除（配合事件缓存，handler 引用稳定）。

### 5.4 子组件更新的两条路径（高频坑）

`shouldUpdateComponent` 返回 false ≠ 子组件不会更新：

- **路径 A（父触发）**：父 diff → 闸门比较 dynamicProps → 变了才 `instance.update()`
- **路径 B（自己触发）**：子 render 中访问过 `props.xxx`（props 是响应式对象），子的渲染 effect 自己收集了依赖 → 父的数据变 → 子的 effect 直接被 trigger

调度器 job 队列用 Set 去重，两条路径同 tick 触发也只跑一次 render。

**反向坑**：父传响应式对象 `:info="userInfo"`，只改 `userInfo.name` → 浅比较 info 引用不变，路径 A 关闭；但子 render 读过 `info.name`，路径 B 照样触发更新。所以「浅比较跳过」不会漏掉深层响应式变化。

### 5.5 一句话版

> 父组件重渲染不等于子组件重渲染。diff 到子组件 vnode 走 `updateComponent`：实例复用，`shouldUpdateComponent` 按编译期 `dynamicProps` 做靶向浅比较（动态 slot/指令/transition 除外），没变就跳过子组件 render；同时子组件有自身依赖收集的独立更新路径，调度器去重。这是 Vue3 不需要 memo 的核心原因之一。

---

## 六、面试速答模板（60 秒版）

> Vue3 渲染优化分两层，互相正交。
>
> **响应式层**：Proxy 拦截 get 时通过 `track` 收集当前活跃的 `ReactiveEffect`，存到 `target → key → Set<effect>` 三层结构里。render、watch、computed 本质都是 effect——render 被包成渲染 effect，watch 带 scheduler，computed 双重身份。这层解决「数据变了哪些组件要重渲染」。
>
> **编译层**：build 时对模板静态分析，做静态提升、patchFlag 打标、连续静态节点预字符串化（超阈值转 innerHTML）、事件缓存，并通过 `openBlock` 代码标记 block 结构。编译一次，优化固化进 render 函数。
>
> **运行层**：数据变化 trigger 后，渲染 effect 进微任务队列批量执行；重跑 render 产出带 block tree 的新 vnode，diff 时跳过静态子树只比对 `dynamicChildren`，单节点按 patchFlag 靶向更新 DOM。这层解决「重渲染时 diff 多快」。
>
> 两套机制叠加：响应式把更新圈在组件边界，编译优化把组件内 diff 范围压到最小。

---

## 七、高频追问清单

1. **依赖收集为什么用 Set？** 天然去重（同一 effect 多次访问同一属性只存一份），且删除方便（cleanupEffect）。
2. **为什么 cleanupEffect 是必要的？** 防止条件分支切换后旧依赖残留——比如 `v-if` 从分支 A 切到 B，A 里访问的属性不应再触发更新。
3. **patchFlag 有哪些常见值？** `TEXT=1`、`CLASS=2`、`STYLE=4`、`PROPS=8`、`FULL_PROPS=16`、`HYDRATE_EVENTS=32`、`STABLE_FRAGMENT=64`、`KEYED_FRAGMENT=128`、`NEED_PATCH=512` 等；带 `FULL_PROPS` 的节点无法被稳定提升。
4. **block tree 和静态提升冲突吗？** 不冲突，是叠加优化：静态提升让静态 vnode 复用跳过创建，block tree 让 diff 跳过静态子树的遍历。
5. **为什么 Vue3 不需要 memo / shouldComponentUpdate？** 响应式依赖收集实现组件级精准更新；组件内又有 block + patchFlag 跳过静态部分。React 是「全量重渲染 + 手动优化」，Vue3 是「按需更新 + 编译期优化」。
6. **v-if 和 v-show 在编译优化上的区别？** `v-show` 编译为带 display style 绑定的动态节点（`NEED_PATCH`），节点不销毁；`v-if` 是 block 级别的切换，不同分支是不同 block。
7. **effect 为什么异步调度？** 合并同一 tick 内的多次数据变更，避免重复渲染；调度器还支持优先级（pre / post）和 job 去重（相同 job 用 Set 去重）。

---

## 八、本次模拟面试纠正记录（2026-08-31）

| 错误表述 | 纠正 |
|---|---|
| 「依赖收集是收集 render、effect」 | 收集的是 ReactiveEffect 实例；render 只是创建 effect 的场景之一 |
| 「预字符串缓存」 | 术语错误，应为「静态节点预字符串化」（stringifyStatic） |
| 「编译时生成 block tree」 | 编译期只在 render 代码里埋 block 标记，block tree 是 runtime 执行时构建 |
| 「diff 遍历 block tree」 | 说反了——block tree 的意义是**不遍历**静态子树，只 diff dynamicChildren |
| 「effect 触发后基于 compiler 结果对比」 | compiler 只在构建时跑一次，重渲染执行的是同一份编译产物 |
| 「页面的 effect 触发」 | 粒度错误——更新是组件级的，不是页面级 |
| 「blockTree 是 fragment，以组件为最小颗粒度」 | block 是角色不是类型（元素/Fragment 都可充当）；重渲染颗粒度是组件，block 嵌套颗粒度由结构指令决定 |
| 「这时候 block 就是组件」 | block ≠ 组件：组件是 instance（含 props/setup/生命周期），block 是其渲染产物 subTree 的根节点；`instance.subTree = block tree` |
| 「组件的某个 effect 触发」 | 只有**渲染 effect** 触发才重渲染；组件上的 watch/computed effect 触发不会重跑 render |

---

## 参考资料

- [2025-2026 大厂 Vue2/Vue3 高频面试题 Top100（CSDN，2026-05）](https://blog.csdn.net/weixin_60526471/article/details/161363280) — 字节/美团考点：PatchFlag、Block Tree、最长递增子序列
- [2026 前端面试题 Vue3 & Nuxt 篇（掘金，2026-02）](https://juejin.cn/post/7611732636969467919) — 编译优化原理（静态提升/PatchFlag 编译产物示例）
- [Vue3 源码拆解：响应式到渲染器（CSDN，2026-08）](https://bbs.csdn.net/weixin_29001683/article/details/100259173) — patchFlag + Block Tree 运行时机制
- 本仓库：[Vue3深度原理](./Vue3深度原理.md)（各模块源码级细节）、[vue3-reactivity-demo.html](./vue3-reactivity-demo.html)（响应式可视化）
