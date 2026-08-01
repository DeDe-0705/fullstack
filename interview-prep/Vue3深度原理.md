# Vue3 深度原理

> 高级前端面试中，Vue3 原理是必考题。面试官不会满足于"我用过 Vue3"，他们会追问响应式怎么实现、diff 怎么优化、compiler 做了什么。

---

## 一、响应式系统

### 1.1 Vue2 vs Vue3 响应式对比

```
Vue2: Object.defineProperty
  - 只能劫持已有属性，新增/删除属性需要 Vue.set/Vue.delete
  - 无法监听数组索引和 length 变化（所以重写了7个数组方法）
  - 初始化时递归遍历所有属性，性能开销大

Vue3: Proxy
  - 代理整个对象，属性增删都能感知
  - 原生支持数组操作
  - 惰性响应式：只有被访问到的嵌套对象才会被代理
  - 支持 Map、Set、WeakMap、WeakSet
```

### 1.2 Proxy 实现响应式的核心代码

```js
function reactive(target) {
  if (typeof target !== 'object' || target === null) return target

  return new Proxy(target, {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver)
      track(target, key)  // 依赖收集
      // 惰性深度响应：访问到嵌套对象时才递归代理
      if (typeof result === 'object' && result !== null) {
        return reactive(result)
      }
      return result
    },
    set(target, key, value, receiver) {
      const oldValue = target[key]
      const result = Reflect.set(target, key, value, receiver)
      if (oldValue !== value) {
        trigger(target, key) // 触发更新
      }
      return result
    },
    deleteProperty(target, key) {
      const hadKey = Object.prototype.hasOwnProperty.call(target, key)
      const result = Reflect.deleteProperty(target, key)
      if (hadKey && result) {
        trigger(target, key)
      }
      return result
    }
  })
}
```

### 1.3 ref 的实现原理

```js
// ref 本质是一个包含 value getter/setter 的对象
class RefImpl {
  constructor(value) {
    this._value = convert(value) // 如果是对象，转成 reactive
    this._rawValue = value
    this.dep = new Set()
  }

  get value() {
    trackRefValue(this) // 收集依赖
    return this._value
  }

  set value(newVal) {
    if (Object.is(newVal, this._rawValue)) return
    this._rawValue = newVal
    this._value = convert(newVal)
    triggerRefValue(this) // 触发更新
  }
}
```

**面试重点：ref vs reactive 怎么选？**

| 维度 | ref | reactive |
|------|-----|----------|
| 数据类型 | 任意类型（基本类型 + 对象） | 仅对象/数组 |
| 解构 | 不会丢失响应式 | 会丢失响应式（需 toRefs） |
| 重新赋值 | 不会丢失响应式 | 会丢失响应式 |
| template 中 | 自动解包 .value | 直接使用 |
| watch 监听 | 需加 .value 或用 getter | 直接监听 |

**关键结论：** 能用 ref 就别用 reactive。ref 重新赋值不丢响应式，解构不丢，心智负担更小。reactive 主要用于表单对象、配置对象等不需要重新赋值的场景。

### 1.4 依赖收集 (track) 与触发更新 (trigger)

```
结构关系：
targetMap: WeakMap<target, depsMap>
  depsMap:   Map<key, dep>
    dep:      Set<effect>

track(target, key):
  1. 从 targetMap 找到/创建 target 对应的 depsMap
  2. 从 depsMap 找到/创建 key 对应的 dep (Set)
  3. 将当前 activeEffect 加入 dep

trigger(target, key):
  1. 找到 target -> depsMap -> dep
  2. 遍历 dep 中的所有 effect，加入调度队列
  3. 通过 scheduler 异步执行
```

### 1.5 computed 原理（脏检查 + 懒执行）

```js
class ComputedRefImpl {
  constructor(getter) {
    this._dirty = true  // 脏标记
    this._value = undefined
    this.effect = new ReactiveEffect(getter, () => {
      // scheduler: 依赖变化时只标记脏，不立即计算
      if (!this._dirty) {
        this._dirty = true
        triggerRefValue(this) // 通知 computed 的依赖者
      }
    })
  }

  get value() {
    trackRefValue(this)
    if (this._dirty) {
      this._dirty = false
      this._value = this.effect.run() // 真正计算值
    }
    return this._value
  }
}
```

**面试话术：** computed 内部维护了一个 `_dirty` 标志。依赖不变时直接返回缓存值，依赖变化只把 `_dirty` 置为 true（不立即计算），直到下一次访问 .value 才真正执行计算。这就是"惰性求值"。

### 1.6 watch vs watchEffect

```
watch(source, callback, options):
  - 显式指定依赖源
  - callback 接收 newVal / oldVal
  - 惰性执行（默认 immediate: false）
  - 支持 flush: 'pre' | 'post' | 'sync'

watchEffect(effect):
  - 自动追踪依赖
  - 立即执行一次
  - 不提供 oldVal
  - 无法控制执行时机
```

---

## 二、虚拟 DOM 与 Diff 算法

### 2.1 什么是虚拟 DOM？

本质是用 JavaScript 对象描述真实 DOM 结构：

```js
// 虚拟节点
const vnode = {
  type: 'div',
  props: { class: 'container', id: 'app' },
  children: [
    { type: 'p', props: null, children: 'Hello' }
  ]
}
```

**为什么需要虚拟 DOM？**
1. 声明式编程，开发者不用手动操作 DOM
2. 跨平台（渲染到 DOM、Canvas、原生等）
3. 批量更新、异步调度，减少真实 DOM 操作

### 2.2 Vue3 Diff 核心优化：PatchFlags（补丁标记）

这是一个面试高频亮点。Vue3 的 compiler 在编译模板时会为动态内容打上标记：

```js
// 编译产物示例
const vnode = {
  type: 'div',
  children: [
    { type: 'span', children: ctx.name, patchFlag: 1 /* TEXT */ },
    { type: 'span', children: ctx.count, patchFlag: 9 /* TEXT + PROPS */ }
  ]
}
```

PatchFlags 枚举：
```
TEXT = 1,           // 动态文本
CLASS = 2,          // 动态 class
STYLE = 4,          // 动态 style
PROPS = 8,          // 动态属性（不含 class/style）
FULL_PROPS = 16,    // 含动态 key 的属性
HYDRATE_EVENTS = 32,// 事件监听
STABLE_FRAGMENT = 64,// 子节点顺序稳定
KEYED_FRAGMENT = 128,// 带 key 的子节点
UNKEYED_FRAGMENT = 256,// 不带 key 的子节点
NEED_PATCH = 512,   // 只需要 patch 不需要比较
DYNAMIC_SLOTS = 1024 // 动态插槽
```

**这意味着什么？** 更新时 Vue3 可以跳过静态节点，只对比标记了 PatchFlag 的动态部分。Vue2 需要全量递归对比。

### 2.3 Block Tree（块树）

```
传统 Diff：遍历整棵 vnode 树
Vue3：只遍历 Block Tree 中标记的动态节点

Block 是一组 vnode 的动态节点的扁平化数组。
渲染时：
1. vnode 树的 "稳定部分"（纯静态）直接跳过
2. 只收集打了 PatchFlag 的动态节点进 block
3. diff 只对比 block 中的节点
```

### 2.4 双端 Diff 到快速 Diff

Vue2 使用双端对比法（首首、尾尾、首尾、尾首），Vue3 进一步优化：

```
Vue3 Diff 策略：
1. 从头部开始同步（相同的 key 和类型）
2. 从尾部开始同步
3. 处理剩余节点：
   - 仅新增：挂载
   - 仅删除：卸载
   - 乱序：用最长递增子序列算法最小化移动
```

**最长递增子序列 (LIS) 的应用：** 找出无需移动的节点，其余节点按需移动/创建/删除，将 DOM 操作降到最少。

---

## 三、Compiler 编译器优化

### 3.1 编译三阶段

```
template → parse(模板 → AST) → transform(优化 AST) → generate(生成代码)
```

### 3.2 静态提升 (Hoist Static)

```html
<!-- 模板 -->
<div>
  <span>静态文本</span>
  <span>{{ dynamic }}</span>
</div>

<!-- 编译后 -->
<script>
const _hoisted_1 = /*#__PURE__*/ createVNode("span", null, "静态文本")
//                ↑ 提升到 render 函数外部，只创建一次
</script>

function render() {
  return createVNode("div", null, [
    _hoisted_1,                          // 复用静态节点
    createVNode("span", null, ctx.dynamic, 1 /* TEXT */)
  ])
}
```

### 3.3 预字符串化

当连续多个静态节点满足条件时，编译器会将它们拼接成字符串通过 `innerHTML` 一次性设置：

```html
<div>
  <span>a</span><span>b</span><span>c</span>...
  <!-- 20 个以上连续静态节点会触发 -->
</div>

<!-- 编译为：createStaticVNode("<span>a</span><span>b</span>...") -->
```

### 3.4 事件缓存

```js
// Vue2：每次渲染创建新函数
onClick: () => ctx.foo()

// Vue3：缓存事件处理函数
onClick: _cache[0] || (_cache[0] = ($event) => ctx.foo())
```

---

## 四、Composition API 核心设计

### 4.1 setup 的执行机制

```
setup(props, context) {
  // 1. 在 beforeCreate 之前调用
  // 2. this 不可用
  // 3. 返回的值暴露给模板
  // 4. 可配合 async/await（需要 Suspense）
}
```

### 4.2 Composables（组合函数）设计模式

这是 Composition API 的核心价值——逻辑复用：

```js
// 鼠标位置跟踪 composable
function useMouse() {
  const x = ref(0)
  const y = ref(0)

  function update(e) {
    x.value = e.pageX
    y.value = e.pageY
  }

  onMounted(() => window.addEventListener('mousemove', update))
  onUnmounted(() => window.removeEventListener('mousemove', update))

  return { x, y }
}

// 在任意组件中使用
const { x, y } = useMouse()
```

### 4.3 对比 Options API

| 维度 | Options API | Composition API |
|------|-------------|-----------------|
| 逻辑组织 | 按选项类型分散（data/methods/computed/watch） | 按功能聚合（一个 composable 包含所有相关逻辑） |
| 逻辑复用 | mixins（命名冲突、来源不清晰） | composables（显式引入、命名空间隔离） |
| TypeScript | 需要复杂的类型推导 | 天然支持 |
| Tree Shaking | 不支持 | 支持（未用到的 API 可被摇掉） |
| 学习曲线 | 低（直观的选项分组） | 中（需要理解响应式原理） |

---

## 五、组件更新调度

### 5.1 nextTick 原理

```
Vue 的 DOM 更新是异步的。
状态改变 → 不会立即更新 DOM → 推入微任务队列 → 统一批量更新

nextTick(callback):
  1. 将 callback 推入微任务队列
  2. 确保在 DOM 更新后执行
```

```js
// 经典面试题
const msg = ref('Hello')
msg.value = 'World'
console.log(document.querySelector('p').textContent) // 'Hello' 还没更新
await nextTick()
console.log(document.querySelector('p').textContent) // 'World'
```

### 5.2 异步更新队列

```
同一个 tick 内多次修改同一个数据，只会触发一次更新：

count.value++  // 触发 scheduler，将更新加入微任务队列
count.value++  // 同一个 tick，effect 已在队列中，不会重复添加
count.value++  // 合并为一次更新
nextTick(() => { /* 这里拿到最终值 3 */ })
```

---

## 六、高频面试题速答

### Q: Vue3 为什么用 Proxy 代替 Object.defineProperty？

- 可以拦截属性新增/删除（不需要 Vue.set/Vue.delete）
- 原生支持数组索引和 length 监听
- 惰性响应式，性能更好（只代理访问到的嵌套对象）
- 支持 Map、Set 等数据结构

### Q: Vue3 的 diff 为什么比 Vue2 快？

- PatchFlags 标记动态内容，跳过静态节点对比
- Block Tree 扁平化动态节点，减少遍历层级
- 最长递增子序列算法优化 DOM 移动
- 静态提升 + 预字符串化减少 vnode 创建开销

### Q: ref 和 reactive 的内部实现区别？

- ref：Object.defineProperty 定义 value 的 getter/setter，适合任意类型
- reactive：Proxy 代理整个对象，仅限对象类型
- ref 在模板中自动解包（不需要 .value），reactive 不解包（但需要 .属性名）
- ref 重新赋值不丢响应式，reactive 会丢

### Q: Composition API 比 Options API 好在哪？

- 逻辑按功能聚合，而非按选项类型分散
- composable 比 mixin 更清晰（命名冲突可控、来源可追溯）
- 更好的 TypeScript 支持
- 支持 tree-shaking

---

## 七、交互式 Demo

打开 [Vue3 响应式系统可视化](./vue3-reactivity-demo.html) 看 Proxy 如何拦截操作、effect 如何收集依赖。
