# Vue3 深度原理

> 高级前端面试中，Vue3 原理是必考题。面试官不会满足于"我用过 Vue3"，他们会追问响应式怎么实现、diff 怎么优化、compiler 做了什么。
>
> 更新于 2026-08-06：补齐生命周期、组件通信、内置组件原理、Vue 3.5/3.6 新特性、SSR 水合等 2025–2026 大厂面试高频考点（来源见文末）。

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

### 1.2.1 Proxy 与 Reflect 深度（面试深挖）

**Reflect 是什么：** ES6 新增的内置对象（不是构造函数，不能 `new`），把 JS 语言内部的属性操作以函数形式暴露出来，与 Proxy 的陷阱一一对应，充当 Proxy 的"默认行为镜像"。

**Reflect 的设计动机：**

1. **操作符函数化**：`in` / `delete` / `new` 是操作符，无法作为值传递；`Reflect.has` / `Reflect.deleteProperty` / `Reflect.construct` 把它们变成普通函数
2. **与 Proxy 对称**：陷阱负责拦截，Reflect 负责原样执行"不拦截时会发生的默认行为"
3. **统一成败表达**：`Reflect.set` / `Reflect.deleteProperty` / `Reflect.defineProperty` 返回布尔值，而 `Object.defineProperty` 失败是抛异常
4. **语义更严格**：`Reflect.ownKeys` 能拿到不可枚举和 Symbol key，`Object.keys` 只拿可枚举字符串；Reflect 对原始值直接抛 TypeError，Object 则先装箱

**为什么 Vue 必须用 `Reflect.get`：receiver 决定 this**

```js
const raw = { a: 1, get b() { return this.a } }

// ❌ 直接 target[key]
// getter 里的 this 指向原始对象 raw，内部访问 raw.a 绕过代理
// → 模板访问 state.b 时，a 的依赖收集会漏掉

// ✅ Reflect.get(target, key, receiver)
// getter 里的 this 指向代理对象（receiver）
// → 内部访问 this.a 会再次走进 get 陷阱 → a 也被 track
```

所以源码里 get 陷阱的标准写法是：先 `track(target, key)`，再用 `Reflect.get(target, key, receiver)` 返回值——两步都不能省。

**最直观的差异：get 陷阱被调用了几次**

```
错误版 target[key]：
  访问 proxy.fullName
  → get 陷阱：key=fullName → track 登记 fullName
  → getter 的 this = raw → this.firstName 直接读原始对象
  → 没有第二次陷阱调用 → firstName 从未登记 ❌

正确版 Reflect.get(target, key, proxy)：
  访问 proxy.fullName
  → get 陷阱：key=fullName
  → getter 的 this = proxy → this.firstName 走进第二次 get 陷阱
  → track 登记 firstName ✅
  → track 登记 fullName ✅
```

**结论：** track 不是"在 get 函数里手动执行一次"，而是"每次属性访问走进代理时自动执行一次"。`target[key]` 让 getter 内部的访问绕过代理，间接属性的依赖永远无法登记——首次渲染正常，之后修改间接属性，视图不更新（数据其实已经变了）。

**receiver 到底是谁（面试第二层深挖）：**

- 一句话：receiver 是"这次操作站在谁的角度执行"，会作为 getter/setter 内部 `this` 的指向；省略时默认等于 target
- 区分两个对象：**target 是"属性定义处"，receiver 是"this 指向处"**
- receiver 由引擎自动传递：`proxy.foo` → receiver 是 proxy 本身；如果 `child` 继承了 proxy，`child.foo` → receiver 是 child（原型链最末端）
- 所以 getter 定义在原型上、`this` 却指向实例，正是靠 receiver 实现的

set 陷阱里 receiver 同样关键——忽略它会把属性写到错误的对象上：

```js
// child 继承了 proxy（proto），对 proto 执行写入时 receiver 是 child
set(target, key, value, receiver) {
  return Reflect.set(target, key, value, receiver)
  // ✅ 属性落在 child 自己身上，proto 不变（保持对象隔离）

  // ❌ 直接 target[key] = value
  // 属性落在 proto 上，所有继承者共享这次修改
}
```

**记忆锚点：** target 决定"数据从哪来"，receiver 决定"this 指向谁"。丢掉 receiver，代理就只是表面拦截，原型链场景的语义会悄悄变歪。

**deleteProperty 的常见误区：删除属性不会删除依赖**

```js
deleteProperty(target, key) {
  const hadKey = Object.prototype.hasOwnProperty.call(target, key)
  const result = Reflect.deleteProperty(target, key)
  if (hadKey && result) trigger(target, key, TriggerOpTypes.DELETE)
  return result
}
```

- 依赖池的增删由"effect 是否还在读取这个 key"决定，不是由删除动作决定：例如 fullName 的 getter 在删除 firstName 后仍会读取 `this.firstName`（即使读到 undefined），所以 firstName 的依赖依然存在
- Vue 中 ADD / DELETE 类型的触发还会额外触发 `ITERATE_KEY` 依赖（`for...in` / `Object.keys`）
- 属性不存在 → hadKey 为 false → 不触发；属性不可配置 → `Reflect.deleteProperty` 返回 false，删除失败

**常用陷阱与 Reflect 对照：**

| 陷阱 | 典型用途 | 委托写法 |
|---|---|---|
| get | 读取时 track | Reflect.get(target, key, receiver) |
| set | 写入时 trigger | Reflect.set(target, key, value, receiver) |
| has | 支持 `'x' in state` 的依赖收集 | Reflect.has(target, key) |
| deleteProperty | 删除时 trigger | Reflect.deleteProperty(target, key) |
| ownKeys | `Object.keys` / `for...in` 的依赖收集 | Reflect.ownKeys(target) |

**has / ownKeys 与 ITERATE_KEY：** `'x' in state` 和 `for...in` 也是响应式场景。新增/删除属性时，所有遍历了对象 key 的 effect 都要触发，Vue 内部用特殊的 `ITERATE_KEY` 标记这类依赖。

**Object vs Reflect 差异速查：**

| 场景 | Object | Reflect |
|---|---|---|
| 拿全部 key | Object.keys 只有可枚举字符串 | Reflect.ownKeys 含不可枚举 + Symbol |
| 定义属性失败 | 抛 TypeError | 返回 false |
| 对原始值操作 | 会装箱（如 Object.keys('a')） | 直接抛 TypeError |

**Proxy 的三个局限（面试常追）：**

1. 只能代理对象，基本类型要靠 `ref` 包装
2. `Object.freeze()` 后的对象无法触发 set，Vue 会告警
3. 有"不变量"约束：非可配置且非可写的属性，get 必须返回真实值，否则抛 TypeError

**面试话术（收尾版）：** "Proxy 负责拦截，Reflect 负责还原"——Reflect 让陷阱能保持默认行为，并通过 receiver 把访问者的身份（this）沿访问链传递下去：getter/setter 内部再访问其他属性时，仍然以代理身份走进陷阱，依赖收集和触发更新不会断链。

注意措辞：这不是 receiver 主动"递归遍历"所有属性，而是"访问链上的每一步都经过代理"；嵌套对象也是惰性包装，访问到才代理。最终效果就是数据变更能完整通知到依赖它的视图。

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
| watch 监听 | 可直接传 ref（自动解包） | 直接监听（默认 deep） |

**关键结论：** 能用 ref 就别用 reactive。ref 重新赋值不丢响应式，解构不丢，心智负担更小。reactive 主要用于表单对象、配置对象等不需要重新赋值的场景。

**真实源码补充：** 上面的 Proxy 实现是简化版。Vue 内部用 `reactiveMap: WeakMap` 缓存 `target → proxy`，同一个原始对象只会被代理一次；get 返回嵌套对象时通过 `toReactive` 复用已有代理，而不是每次新建。所以 `reactive(obj) === reactive(obj)` 恒成立。

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
  - 支持 flush: 'pre' | 'post' | 'sync'（默认 pre）
```

**注意：** watchEffect 同样支持 `flush` 选项（默认 `pre`），并不是"无法控制执行时机"；它只是不像 watch 那样需要显式声明依赖源。Vue 3.5 起还提供全局 `onWatcherCleanup()` 在 watch 回调内注册清理函数（见第七章）。

### 1.7 响应式进阶与边界（面试深挖区）

**浅层响应式：** `shallowRef` / `shallowReactive` 只代理第一层，适合"整体替换、内部不变"的大对象；`triggerRef(shallowRef)` 可强制触发依赖。

**跳过代理：** `markRaw` 标记对象永不被代理（第三方库实例、图标对象），避免无意义的劫持开销；`readonly` / `shallowReadonly` 做只读包装，组件的 props 本质就是 shallowReadonly。

**链接引用：** `toRef(obj, key)` / `toRefs(obj)` 把对象属性变成独立 ref 并保持与原对象的连接（解决解构丢失响应式）；`unref` / `isRef` / `toValue`（3.3+）用于 composable 参数归一化——reactive props 解构后的变量传入 composable 时，用 `toValue()` 同时兼容 ref / getter / 普通值。

**自定义响应式：** `customRef` 可自定义 get/set 中的 track/trigger，典型场景是防抖输入框。

**reactive 的两个经典坑：**

```js
// 坑 1：整体替换会丢响应式
state = newObj          // ❌ 变量指向新对象，原代理失效
Object.assign(state, newObj) // ✅ 原地合并，保留代理

// 坑 2：解构会丢响应式
const { count } = state // ❌ count 是普通值
const { count } = toRefs(state) // ✅ 保持响应式
```

**ref 在 reactive 中的自动解包：**

```js
const state = reactive({ count: ref(1) })
state.count // 1，ref 被自动解包

// 但数组和 Map/Set 容器里的 ref 不会解包
const arr = reactive([ref(1)])
arr[0] // RefImpl 对象，不是 1
```

**集合类型：** reactive 代理 Map/Set/WeakMap/WeakSet 时会拦截 `get/set/has/add/delete/forEach/迭代器` 等内部方法（源码中叫 instrumentations），所以 `map.size`、`map.get()` 也能被 track 和 trigger。

**watch 深度监听的代价：** `watch(obj, cb, { deep: true })` 会递归 `traverse()` 收集整棵对象的所有属性；大对象上应优先改成 getter 精确监听：

```js
watch(() => obj.list.length, cb) // 只依赖 length，比 deep 便宜得多
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
NEED_HYDRATION = 32, // 需要水合（SSR）
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

### 2.4 Vue2 双端 Diff vs Vue3 快速 Diff

**先纠正一个常见口误：** Vue3 并没有沿用双端 Diff，它使用的是"头尾同步 + 最长递增子序列"的快速 Diff（fast diff）。

- Vue2：双端对比法，首首、尾尾、首尾、尾首四个方向移动指针；遇到乱序仍需遍历查找 key 并移动，最坏情况下操作较多
- Vue3：先头尾同步，再处理剩余节点

```
Vue3 快速 Diff 策略：
1. 从头部开始同步（相同 key 和类型直接 patch）
2. 从尾部开始同步
3. 处理剩余节点：
   - 仅新增：挂载
   - 仅删除：卸载
   - 乱序：建立 keyToNewIndexMap + 最长递增子序列（LIS）最小化移动
```

**最长递增子序列 (LIS) 的应用：** 找出无需移动的节点，其余节点按需移动/创建/删除，将 DOM 操作降到最少。

### 2.5 key 的作用与 v-for 注意事项

- key 是 diff 判断"是否是同一个节点"的唯一依据：同 key 同类型 → 原地 patch；key 变化 → 卸载重建
- 不要用 index 当 key：数组头部插入/删除时 index 全部错位，Vue 会复用错误的 DOM，导致输入框内容、组件状态错乱；优先用业务唯一 id
- Vue3 中 `v-if` 的优先级高于 `v-for`（Vue2 相反），但同一元素上同时使用两者仍是反模式，应拆到 `<template>` 里
- v-for 编译为 `KEYED_FRAGMENT (128)`，子节点走 keyed diff 路径

### 2.6 v-once / v-memo

- `v-once`：只渲染一次，后续数据变化不再更新（编译期把子树标记为已缓存 vnode）
- `v-memo="[deps]"`（3.2+）：依赖数组不变时复用整棵子树，适合 v-for 中的昂贵列表项；依赖变化才重新渲染
- 二者都是用"确定性"换性能，滥用会引入一致性 bug，只用于明确的静态/大列表场景

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

### 3.5 v-model 的编译原理（高频）

原生元素 `v-model="msg"` 由编译器按元素类型展开：

```js
// input[type=text]
//   → :value="msg" @input="msg = $event.target.value"
// checkbox / radio
//   → :checked="msg" @change="msg = $event.target.checked"
// select
//   → :value="msg" @change="msg = $event.target.value"
```

组件上的 v-model 是语法糖，编译结果非常固定：

```js
// 模板：<Child v-model="foo" v-model:title="bar" />

// 编译后：
//   <Child
//     :modelValue="foo"
//     @update:modelValue="foo = $event"
//     :title="bar"
//     @update:title="bar = $event"
//   />
```

组件内部对应：

```js
defineProps(['modelValue', 'title'])
defineEmits(['update:modelValue', 'update:title'])
```

Vue 3.4+ 推荐用 `defineModel()` 简化：

```js
const model = defineModel()        // modelValue + update:modelValue
const title = defineModel('title') // 命名参数
model.value = 'x'                  // 自动 emit update:modelValue
```

**面试话术：** v-model 本质是 `modelValue` prop + `update:modelValue` 事件；`defineModel` 只是把这对声明封装成可读写的 ref，编译后仍然是同样的 prop/emit。

### 3.6 插槽的编译原理

- 普通插槽：子组件 children 编译成 `{ default: () => vnode }` 形式的对象，父组件更新时决定插槽内容是否重新渲染
- 作用域插槽：`<slot :item="item">` 编译成函数 `({ item }) => vnode`，子组件通过 `$slots.default({ item })` 调用，把数据作为参数传给父级插槽模板
- 动态插槽会打 `DYNAMIC_SLOTS (1024)` 标记：父组件更新时必须强制重新渲染插槽内容
- **面试常问：为什么作用域插槽能拿到子组件数据？** 因为编译后是"父模板作为函数、子组件负责调用"，数据由函数参数传入，本质是 render 函数组合

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

### 4.4 Vue3 生命周期（必背表）

| Composition API | Options API | 触发时机 |
|---|---|---|
| setup() | beforeCreate / created | 组件实例创建阶段（setup 统一替代两者） |
| onBeforeMount | beforeMount | 挂载前 |
| onMounted | mounted | 挂载后，DOM 可访问 |
| onBeforeUpdate | beforeUpdate | 响应式数据变化后、重新渲染前 |
| onUpdated | updated | 重新渲染后 |
| onBeforeUnmount | beforeUnmount | 卸载前（清理定时器/事件监听） |
| onUnmounted | unmounted | 卸载后 |
| onActivated / onDeactivated | activated / deactivated | 被 keep-alive 缓存组件激活 / 失活 |
| onErrorCaptured | errorCaptured | 捕获后代组件错误（返回 false 阻止继续向上传播） |
| onServerPrefetch | serverPrefetch | SSR 数据预取 |

**父子组件执行顺序：**

```
挂载：父 setup → 子 beforeMount/mounted → 父 mounted
更新：父 beforeUpdate → 子 beforeUpdate/updated → 父 updated
卸载：父 beforeUnmount → 子 beforeUnmount/unmounted → 父 unmounted
```

**高频追问：**

1. 请求放 onMounted 还是 setup？都可以，但 onMounted 保证 DOM 和父子关系已就绪，且 SSR 下不会执行（setup 会执行），放 onMounted 更安全；需要 SSR 预取用 onServerPrefetch
2. 为什么 Vue3 没有 beforeCreate/created 了？setup 统一了初始化逻辑，选项合并层不再需要这两个钩子
3. onUpdated 里直接改状态会怎样？会反复触发更新死循环，必须加条件判断

### 4.5 effectScope：批量管理副作用

```js
const scope = effectScope()

scope.run(() => {
  const count = ref(0)
  watchEffect(() => console.log(count.value))
  const doubled = computed(() => count.value * 2)
})

scope.stop() // 一次性停止 scope 内所有 effect / computed / watch
```

- 应用场景：组件卸载时副作用自动清理；但"在非组件上下文或事件回调里动态创建 watch/computed"时，Vue 不知道何时回收，需要 effectScope 手动管理，避免内存泄漏
- 相关 API：`getCurrentScope()`、`onScopeDispose()`（类似 onUnmounted，但作用于 scope）
- **面试话术：** 组件级副作用由 Vue 自动回收；非组件生命周期内创建的副作用要靠 effectScope 批量 stop

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

## 六、组件通信与内置组件原理

### 6.1 props / emit / attrs / expose 模型

- props 是单向数据流：父传子，子组件不能直接改；props 对象本质是 shallowReadonly，修改会告警
- emit 用于子 → 父：`defineEmits(['update:title'])` 声明后 `emit('update:title', v)`；Vue3 中不再有 `$on / $off` 事件总线
- attrs：未被子组件声明为 props/emits 的属性与监听器（Vue3 中事件监听器也在 attrs 里）；`inheritAttrs: false` 可控制是否自动落到根节点
- expose：`defineExpose()` 明确暴露给父组件通过模板 ref 访问的能力，其余一律私有（Vue3 默认不暴露实例上的所有内容）

**一句话模型：** props 向下、emit 向上、provide/inject 穿透、slots 内容分发、ref + expose 命令式访问。

### 6.2 provide / inject 原理

- provide 把值挂到当前组件实例的 `provides` 对象上；inject 沿组件实例链向上查找（源码利用 provides 对象间的原型链继承）
- **默认不是响应式**：provide 一个普通对象，后代改值不会同步；要响应式必须 provide ref/reactive 本身
- 应用级注入：`app.provide(key, value)`，所有组件可注入
- 适用场景：主题、用户信息、国际化、依赖注入式配置

### 6.3 keep-alive 原理（LRU 缓存）

- keep-alive 不渲染真实元素，而是拦截组件 vnode，把子树缓存到内部 cache
- 命中缓存：不重新创建组件实例，直接复用 vnode 和 DOM，触发 onActivated
- 淘汰策略：LRU——`max` 限制缓存数量，超出时淘汰最久未使用的实例
- include / exclude 控制缓存名单；常与 `<component :is>` 配合
- **面试话术：** 本质是"组件实例级缓存 + LRU 淘汰"，所以能保留滚动位置、输入内容和内部状态

### 6.4 Teleport 原理

- 把子树渲染到目标 DOM 节点：`<Teleport to="#modal">`，内部 vnode 的 el 直接挂载到 target
- 组件逻辑仍属于父组件：事件冒泡、依赖收集、provide/inject 都保持原组件树关系，只是 DOM 位置变了
- Vue 3.5+ 支持 `defer`：目标元素由 Vue 后续渲染时，也能等当前渲染周期结束后再挂载
- 适用：Modal、Toast、Dropdown，避免被父级 overflow 或层叠上下文裁剪

### 6.5 Transition / TransitionGroup 原理

- 进入：插入 DOM → 添加 enter-from（首帧）→ 下一帧移除并添加 enter-active → transitionend/超时后移除并触发 after-enter
- 离开：添加 leave-from → 下一帧 leave-active → transitionend 后移除 DOM
- 支持 JS 钩子（beforeEnter / enter / afterEnter / leave / afterLeave），返回 Promise 可精确控制结束时机
- TransitionGroup 对列表增删做单个元素过渡，key 是定位依据

### 6.6 Suspense 原理

- 组件树中存在异步依赖（async setup / async 组件）时，先渲染 fallback；全部 resolve 后渲染真实内容
- **面试重点：** Suspense 在 Vue3 中更多是"实验性边界"，SSR 场景才真正成熟；Vapor Mode 当前不支持 Suspense（见第七章）

### 6.7 v-if / v-show / 自定义指令

- v-if：条件渲染，false 时节点不创建（卸载）；v-show：始终渲染，仅切换 `display`
- 切换频繁用 v-show（保留 DOM 和状态）；首屏不需要用 v-if（减少创建开销）
- 自定义指令钩子：created → beforeMount → mounted → beforeUpdate → updated → beforeUnmount → unmounted；典型场景：权限、聚焦、水印、埋点

---

## 七、Vue 3.5 / 3.6 新特性（2025–2026 新考点）

### 7.1 Vue 3.5 响应式重构：双向链表 + 版本计数

- 依赖结构从 Set 集合改为**双向链表**：遍历/删除依赖更快，整体内存占用减少约 56%
- **版本计数**：每个依赖维护 version，computed 先比较版本是否变化，未变化直接返回缓存，避免重复计算和陈旧值问题
- 深响应式大数组操作最高提升约 10 倍
- **面试话术：** 3.5 没有改变"track/trigger"模型，而是把依赖的数据结构换成了双向链表 + 版本号，让依赖收集/触发和 computed 缓存判断更快、更省内存

### 7.2 Vue 3.5 实用新 API

| API | 作用 |
|---|---|
| reactive props 解构（稳定） | `const { count = 0 } = defineProps()` 用原生默认值语法；解构变量仍响应式，但 watch/composable 需 getter / toValue |
| useTemplateRef() | 运行时按字符串 id 取模板 ref，支持动态 ref 名 |
| useId() | 生成 SSR 稳定的唯一 id，避免水合不一致 |
| defineModel()（3.4 稳定） | v-model 双绑定的声明式封装 |
| onWatcherCleanup() | watch 回调内的清理注册（如 AbortController） |
| defineAsyncComponent hydrate | 控制 SSR 组件水合时机：hydrateOnVisible 等 |
| `<Teleport defer>` | 目标节点稍后渲染也能挂载 |
| data-allow-mismatch | 主动豁免已知的水合不一致告警 |

### 7.3 Vue 3.6：alien-signals + Vapor Mode（2025-12 beta → 2026 进入 RC）

**alien-signals（响应式引擎重构）：**

- `@vue/reactivity` 底层改为 alien-signals，ref 内部就是 signal
- 官方 beta 说明：响应式性能比 3.5 快约 1.8 倍、computed 吞吐量提升 30 倍以上、内存占用进一步下降（beta 数据，以正式版为准）
- 对现有代码无破坏性变更
- 版本节奏：3.6 于 2025 年 12 月进入 beta（beta.17 于 2026-06-24 发布），随后进入 RC 阶段，正式版尚未发布

**Vapor Mode（无虚拟 DOM 编译模式）：**

- 编译期直接生成操作真实 DOM 的指令，跳过 VNode 创建与 diff
- 按组件可选启用：`<script setup vapor>` 或文件名 `MyComp.vapor.vue`；`createVaporApp()` 是实验性的全 Vapor 应用 API
- 可与虚拟 DOM 组件在同一组件树中混用；Options API、Suspense、`app.config.globalProperties` / `getCurrentInstance()` 暂不支持
- **面试话术：** Vapor Mode 不是"淘汰虚拟 DOM"，而是给高频叶子组件提供第二条编译路径——用编译时的确定性替换运行时的 diff 开销

### 7.4 2026 面试趋势判断

- 搜索到的 2026 大厂面经中，Vue 考点仍集中在：响应式原理（Proxy / track / trigger）、diff 优化、生命周期、组件通信、keep-alive、v-model 原理
- 加分项：能主动讲清 Vue 3.5 响应式重构、Vapor Mode 与 alien-signals 的定位——这是"持续关注最新技术趋势"的高级岗信号
- 参考来源见文末

---

## 八、SSR 与水合（进阶考点）

- SSR：服务端把组件渲染成 HTML 字符串，客户端再"接管"事件与响应式，这个过程叫 hydration（水合）
- 水合不一致：服务端与客户端渲染结果不同（日期、随机数、浏览器 API），Vue 会告警并强制客户端重新渲染
- 解决手段：`useId()` 生成稳定 id、`data-allow-mismatch` 主动豁免、懒水合（`defineAsyncComponent` 的 hydrate 策略：可见/空闲/交互时再水合）
- **面试话术：** SSR 的价值是首屏时间和 SEO，代价是水合复杂度与服务器成本；高级岗要能讲清 mismatch 的产生原因与处理手段

---

## 九、高频面试题速答

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

### Q: v-model 的原理是什么？

- 原生元素按类型展开为 value/checked + 对应事件
- 组件上是语法糖：`modelValue` prop + `update:modelValue` 事件
- `defineModel()` 编译后仍是 prop + emit，只是开发者写法更简洁

### Q: key 的作用是什么？为什么不能用 index？

- key 是 diff 判断"同一个节点"的依据，同 key 同类型原地 patch，key 变化才卸载重建
- index 在头部增删时会整体错位，复用错误 DOM 导致输入框内容、组件状态错乱；应使用业务唯一 id

### Q: keep-alive 的实现原理？

- 拦截组件 vnode，缓存实例与 DOM，命中时直接复用并触发 onActivated
- LRU 淘汰：max 超限时淘汰最久未使用的实例
- include/exclude 控制缓存名单

### Q: watch 和 watchEffect 什么时候用？

- 需要精确控制监听源、需要 old/new 值、需要配置 deep/immediate → watch
- 需要自动追踪依赖、逻辑就是"依赖变了就执行" → watchEffect
- 两者都支持 flush: pre/post/sync；DOM 更新后访问用 flush: 'post' 或 watchPostEffect

### Q: provide/inject 是响应式的吗？

- 默认不是：provide 普通对象，后代不会自动同步
- provide 一个 ref/reactive 本身，后代拿到的是同一响应式对象，天然响应式
- 源码实现：provides 对象原型链继承，inject 沿链向上查找

### Q: Vue 3.5 对响应式做了什么重构？

- 依赖从 Set 改成双向链表，内存减少约 56%
- 引入版本计数，computed 先比较版本再决定是否重算，解决陈旧值与多余计算
- 深响应式大数组操作最高提升约 10 倍；没有行为变化，API 完全兼容

### Q: Vapor Mode 是什么？

- Vue 3.6（beta）新增的编译模式：跳过虚拟 DOM，编译期直接生成操作真实 DOM 的指令
- 按组件 opt-in（`<script setup vapor>` / `.vapor.vue`），可与虚拟 DOM 组件混用
- 不是淘汰虚拟 DOM，而是给高频组件提供"零 diff 开销"的第二条路径

---

## 十、交互式 Demo

打开 [Vue3 响应式系统可视化](./vue3-reactivity-demo.html) 看 Proxy 如何拦截操作、effect 如何收集依赖，以及新增/删除属性为什么 Vue2 做不到。

---

## 十一、参考资料（2025–2026 趋势来源）

- MDN：Proxy — https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy
- MDN：Reflect — https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Reflect
- Vue 官方博客：Announcing Vue 3.5（响应式重构、props 解构、useTemplateRef、useId、懒水合等）— https://blog.vuejs.org/posts/vue-3-5
- Vue 官方 GitHub：v3.6.0-beta.1 Release Notes（Vapor Mode、alien-signals）— https://github.com/vuejs/core/releases/tag/v3.6.0-beta.1
- 掘金：Vue 3.6 还没正式发布，但前端的方向已经被它定下来了（2026-07）— https://juejin.cn/post/7660079523232399402
- CSDN：大厂前端面试最新整理笔记（2026-02，Vue 编译/性能优化/Modal 设计等）— https://blog.csdn.net/WYiQIU/article/details/157652339
- 三年前端面试复盘：字节阿里美团高频题与手写源码解析（2026-04）— https://zeeklog.com/2026chun-zhao-san-nian-qian-duan-xie-lei-mian-jing-na-xia-zi-jie-a-li-mei-tuan-offer-zhe-xie-gao-pin-ti-ni-bi-xu-zhang-wo-fu-shou-xie-yuan-ma-9
