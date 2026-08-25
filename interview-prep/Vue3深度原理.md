# Vue3 深度原理

> 高级前端面试中，Vue3 原理是必考题。面试官不会满足于"我用过 Vue3"，他们会追问响应式怎么实现、diff 怎么优化、compiler 做了什么。
>
> 更新于 2026-08-06：补齐生命周期、组件通信、内置组件原理、Vue 3.5/3.6 新特性、SSR 水合等 2025–2026 大厂面试高频考点（来源见文末）。

---

## 零、总纲：编译期与运行时（Vue2 vs Vue3）

### 0.1 compiler 和 runtime 分别是什么

| | 职责 | 什么时候跑 | 产物 |
|---|---|---|---|
| Runtime（运行时） | 响应式、组件渲染、虚拟 DOM、diff / patch | 浏览器里执行 | 真实 DOM |
| Compiler（编译器） | 模板 → render 函数 / vnode，并做静态分析优化 | 构建时（或浏览器全量版） | render 函数 |

一句话：**compiler 负责「翻译 + 优化」模板，runtime 负责「跑起来」并做 diff。**

### 0.2 Vue2 vs Vue3：编译器和运行时的协同程度变了

- **Vue2**：编译器基本只做「模板 → render 函数」的翻译，优化很少；运行时拿到**普通 vnode**，**全量递归 diff**。→ 编译期省力，运行时费力。
- **Vue3**：编译器做大量静态分析（静态提升、PatchFlag、Block Tree、预字符串化、事件缓存），把优化信息**编码进 vnode**；运行时按标记**只 diff 动态节点**。→ 编译期做重活，运行时省力。

本质：**Vue3 把「运行时才能知道的信息」提前到「编译期」就标记好了。**

### 0.3 runtime 三大变化（Vue2 → Vue3）

**① 响应式系统（最底层）**

| | Vue2 | Vue3 |
|---|---|---|
| 实现 | Object.defineProperty | Proxy |
| 初始化 | 递归劫持所有属性 | 惰性代理（访问到才包装） |
| 新增 / 删除属性 | 感知不到（$set / $delete） | 能感知 |
| 数组索引 / 长度 | 感知不到（重写数组方法） | 能感知 |

**② Diff 算法**

| | Vue2 双端 diff | Vue3 快速 diff |
|---|---|---|
| 策略 | 首首 / 尾尾 / 首尾 / 尾首 四指针 | 头尾同步 + 中间 LIS |
| 中间乱序 | 反复遍历查找 key，可能退化 O(n²) | keyToNewIndexMap + LIS，O(n log n) |
| 移动次数 | 较多 | 最少 |

**③ 更新调度器**

Vue3 有专门的 `flushJobs`：队列**去重**（同一组件多次改只更新一次）+ **按 id 排序**（父先于子）+ 微任务 flush。这就是 `nextTick` 能拿到「更新后 DOM」的原因。

### 0.4 编译期优化 vs runtime diff 是两个层面

```
编译期（PatchFlag / BlockTree / 静态提升）→ 缩小 diff 的「范围」（跳过静态）
运行时（快速 diff / LIS）              → 减少 diff 的「操作次数」（最少移动）
```

一个减范围、一个减移动，叠加才是完整的「Vue3 diff 快」。

### 0.5 构建形态：Full vs Runtime-only

- **完整版（full）**：compiler + runtime 都有，浏览器里能直接编译 `template`；
- **运行时版（runtime-only）**：只有 runtime，更小，但模板必须在**构建时**预编译（vue-loader / @vue/compiler-sfc）；
- 项目里 `import Vue from 'vue'` 基本都是 runtime-only + 预编译。

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
- **receiver ≠ 函数调用时的 this**：receiver 由"属性访问表达式"决定，`obj.prop` 的 receiver 永远是 obj（访问链末端），与之后如何调用无关。`proxy.say.apply(brother)` 里，get 陷阱的 receiver 仍是 proxy（因为读取点是 `proxy.say`），brother 只是 `apply` 传给函数的调用 this——两套机制独立，别混。

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
| 解构 | 不适用（ref 是单值，用 `.value`） | 会丢失响应式（需 toRefs） |
| 重新赋值 | 不会丢失响应式 | 会丢失响应式 |
| template 中 | 自动解包 .value | 直接使用 |
| watch 监听 | 可直接传 ref（自动解包） | 直接监听（默认 deep） |

**关键结论：** 能用 ref 就别用 reactive。ref 重新赋值（`r.value = x`）不丢响应式；reactive 整体替换 / 解构都会丢（`toRefs` 保解构）。reactive 主要用于表单对象、配置对象等不需要重新赋值的场景。

> ⚠️ **易错**：解构时两者都会丢——`const { count } = reactive({ count: 1 })` 的 count 是普通值；`const { value } = ref(1)` 的 value 也是普通值。区别是 ref 是单值、本来不需要解构；要保 reactive 解构用 `toRefs()`。**ref 真正的优势是「重新赋值」，不是「解构」**。

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

**大白话理解 Dep（Dependency）：** `dep` 不是"依赖项"，而是"**依赖这个属性的 effect 集合**"，源码里就是 `Set<ReactiveEffect>`（Vue 3.5 起改为双向链表）。打个比方：属性是电台，dep 是它的**订阅者名单**——渲染函数/计算属性/watchEffect 执行期间读过 `state.count`，就被登记进 `count` 的名单；`count` 一变，trigger 按名单逐个通知。

三层结构的分工：`targetMap` 定位"哪个对象"，`depsMap` 定位"哪个属性"，`dep` 拿到"哪些 effect 要更新"。

**为什么 targetMap 用 WeakMap 而不是 Map？** 如果 targetMap 是强引用 Map，那么每个 `reactive(obj)` 过的对象都会被永久钉在内存里，即使业务上已经没人再使用它。用 WeakMap 后：对象不再被业务代码引用 → 整张 depsMap 自动可回收，**不需要手动把它从依赖池里删掉**。

注意边界：组件卸载时，Vue 还会主动 `stop(renderEffect)`，把渲染 effect 从它登记过的所有 dep 中移除。两件事是互补的——**卸载时主动清，对象失去引用时自动清**。

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

#### computed 的两层短路（2026 高频深挖）

"依赖变了但值没变"的场景有两层 Object.is 短路，位置不同、挡住的东西不同：

| | 第一层 | 第二层 |
|--|--------|--------|
| 位置 | **数据源 set**（ref / reactive 拦截器） | **computed 求值之后**（ComputedRefImpl 内部） |
| 判断 | `hasChanged(newValue, oldValue)` 新旧值是否相等 | `hasChanged(newResult, oldResult)` 新旧**计算结果**是否相等 |
| 挡住什么 | trigger 本身——依赖通知根本不发生 | `triggerRefValue`——computed 的订阅者不被通知 |
| 效果 | computed 不重算，dirty 不置位 | 视图不重渲（渲染 effect 不执行，没有 vnode、没有 diff） |

```js
firstName.value = '德'   // 赋相同的值
// 第一层短路：ref setter 里 hasChanged 为 false → 直接 return
// → trigger 没执行 → computed 的 dirty 未置位 → 返回缓存

firstName.value = '王'   // 真变了，但 computed 结果恰好没变
// 第一层通过 → dirty = true → 求值
// 第二层短路：求值后 hasChanged(新结果, 旧结果) 为 false
// → 不 triggerRefValue → 渲染 effect 不重跑 → 视图不更新
```

注意第三道保险（渲染 effect 重跑了但新 vnode 与旧 vnode 相同 → patch 无操作）确实存在，但用它解释上述场景是答非所问——前两层短路下渲染 effect 根本不会执行。

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

**flush 语义表（面试常追）：**

| flush | 执行时机 | 典型场景 |
|---|---|---|
| pre（默认） | 数据变化后、组件重新渲染前，同 tick 批量 | 大多数业务逻辑（请求、状态派生） |
| post | 组件重新渲染后，DOM 已更新 | 回调里读最新 DOM（高度、滚动位置、focus） |
| sync | 数据一变立即同步执行，不批量 | 极少用，强实时性场景，性能差 |

**watch 回调的清理（3.5+）：** 在回调内注册 `onWatcherCleanup(fn)`，下次回调触发或组件卸载时自动执行，适合取消上一次请求/定时器：

```js
watch(keyword, (val) => {
  const controller = new AbortController()
  const timer = setTimeout(
    () => fetch(`/api/search?q=${val}`, { signal: controller.signal }),
    300
  )
  onWatcherCleanup(() => {
    clearTimeout(timer)
    controller.abort()
  })
})
```

### 1.7 响应式进阶与边界（面试深挖区）

**惰性响应式的两层（性能核心）：**

1. **对象包装惰性**：`reactive()` 创建时只代理最外层，嵌套对象在"被访问"时才包装成 Proxy（Vue2 是初始化时递归 defineProperty 所有属性，哪怕永远用不到）
2. **依赖收集惰性**：只有"effect 执行期间真正读过的属性"才登记进依赖池；没读过的属性变更时 trigger 找不到依赖，零更新开销

```js
const state = reactive({ a: 1, b: 2, nested: { x: 10 } })
// 创建时 nested 还没被代理；effect 只读 a → 依赖池只有 a
// state.b = 99 → 不触发任何更新；首次读 nested.x 时才包装 nested
```

**面试话术：** Proxy 的拦截是"全能"的（所有属性的 get/set 都能看到），Vue 只是不为没读过的属性登记依赖——"惰性"指的是登记惰性，不是拦截惰性。

**浅层响应式：** `shallowRef` / `shallowReactive` 只代理第一层，适合"整体替换、内部不变"的大对象；`triggerRef(shallowRef)` 可强制触发依赖。

**跳过代理：** `markRaw` 标记对象永不被代理（第三方库实例、图标对象），避免无意义的劫持开销；`readonly` / `shallowReadonly` 做只读包装，组件的 props 本质就是 shallowReadonly。

#### toRaw / markRaw / proxyMap：Proxy 局限的三大补救（2026-08-23 补）

| API | 一句话 | 补的 Proxy 局限 |
|-----|--------|----------------|
| `toRaw(proxy)` | 剥掉代理壳拿原始对象 | 代理对象与原对象 `===` 不等、拦截器有开销 |
| `markRaw(obj)` | 给对象盖"免代理章"，永远不包 Proxy | 有些对象根本不该被代理（三方类实例、大静态数据） |
| `proxyMap` | 引擎内部的原对象→代理 WeakMap 缓存 | 防止同一对象被重复代理（内部机制，非公开 API） |

**toRaw 的四个用途 + 两大坑：**

```js
toRaw(state) === raw        // true，脱壳后就是原来那个对象
const raw = toRaw(state)
raw.count = 100             // ⚠️ 坑1：不走 set 拦截器 → 不 trigger → 视图不更新
                            //    toRaw 是"只读逃生门"——用它读、用它传，别用它写
toRaw(state).user           // ⚠️ 坑2：只脱一层，user 若已被代理仍是 Proxy
```

用途：① 跨边界等值判断（`toRaw(a) === b`）；② 性能敏感路径绕开 track 开销；③ 传给三方库（其内部 `===` 缓存判断会被代理对象打乱）；④ 深序列化前的稳妥脱壳。

**markRaw 的典型事故现场（可视化岗位送命题）：**

```js
// ❌ ECharts/G6 实例放进 reactive/ref 容器
const state = reactive({ chart: null })
state.chart = echarts.init(el)
// 实例被深度代理 → 内部 this 判断/私有字段/缓存全乱 + 上万属性全被代理 → 性能暴跌

// ✅ 解法一：markRaw(state.chart = echarts.init(el)) —— 注意 ref 内部对对象也会调 reactive，markRaw 同样适用
// ✅ 解法二：组件内普通变量持有，不进响应式系统
```

细节：markRaw 打 `__v_skip` 标记，`reactive()` 包装前检查到就返回原对象；被标记对象的**整棵子树**都不会被代理（父对象压根不进代理流程）。对象后续变化不触发更新——需要"变了要更新"就别 markRaw，改用 shallow + triggerRef。

**proxyMap 的三个短路行为：**

```js
const proxyMap = new WeakMap()  // Vue 内部：key=原对象, value=代理

reactive(obj) === reactive(obj)              // true：第二次走缓存
reactive(reactive(obj)) === reactive(obj)    // true：isProxy 直接返回自身
state.user; state.user  // 两次访问返回同一个代理：惰性代理靠 proxyMap 不重复包装
```

同一原始对象全局只有一个代理实例，依赖收集才不会分裂。判定 API（`isRef/isReactive/isProxy`）本质是读对象内部标记（`__v_isRef` 等），不是 instanceof。

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

**结构边界：v-if / v-for 为什么各自成 Block？**

`dynamicChildren` 是「扁平数组」，默认树结构稳定（位置一一对应）。但 v-if 的分支可能整段消失/出现、v-for 的数量和顺序可能变——如果把这些动态节点直接扁平收集进父 Block，两次渲染的数组长度/含义会对不上，diff 就会错位（更新打到错误节点、漏挂载/漏卸载）。

所以编译器遇到 v-if / v-for 时会**切断收集**，让它们各自成一个 Block（结构边界）。父 Block 的 `dynamicChildren` 只把它们当作「一个动态子节点」，不再往下收集：

```
div（Block）
 ├─ dynamicChildren: [ h1,  v-if块,  ul片段 ]
 │
 │   h1（TEXT 动态）
 │
 │   v-if 块（自己一个 Block）
 │        └─ 内部处理 show 切换：整块挂载/卸载
 │
 └─ ul 片段（Fragment Block，KEYED_FRAGMENT）
          └─ 内部处理 list：走 keyed diff / LIS
```

- v-if：父 Block 只看到「这个 v-if 块」，分支切换时**整块替换/挂载/卸载**，由 v-if 块保证正确
- v-for：父 Block 只看到「这个 ul 片段」，增删改顺序交给 keyed diff（LIS）

**一句话：** 「动态收集」的递归到结构边界就停，往里由它自己负责——普通结构可安全扁平化，会变结构（v-if/v-for）必须各自成 Block 才能保证正确性。

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

**中间乱序的具体步骤（以 [A,B,C] → [C,A,B] 为例）：**

```
1. 建索引：keyToNewIndexMap = { C: 0, A: 1, B: 2 }（key → 新位置）
2. 按旧顺序遍历 [A, B, C]，查表得到新位置序列 seq = [1, 2, 0]；查不到的旧节点直接卸载
3. 对 seq 求 LIS = [1, 2] → 对应 A、B 不用移动
4. C（位置 0）需要移动：把 C 的 DOM insertBefore 到最前面
```

**面试话术：** keyToNewIndexMap 负责"快速定位旧节点的新位置"，LIS 负责"找出相对顺序未变的节点不动，其余节点围绕它们移动"，从而把 DOM 移动次数降到最少。

### 2.5 key 的作用与 v-for 注意事项

- key 是 diff 判断"是否是同一个节点"的唯一依据：同 key 同类型 → 原地 patch；key 变化 → 卸载重建
- 不要用 index 当 key：数组头部插入/删除时 index 全部错位，Vue 会复用错误的 DOM，导致输入框内容、组件状态错乱；优先用业务唯一 id
- Vue3 中 `v-if` 的优先级高于 `v-for`（Vue2 相反），但同一元素上同时使用两者仍是反模式，应拆到 `<template>` 里
- v-for 编译为 `KEYED_FRAGMENT (128)`，子节点走 keyed diff 路径

**为什么 index 会导致输入框内容错位（面试深挖）：** 三行 A/B/C 用 index 作 key 时，删除 A 后新列表 B/C 的 key 变成 0/1——Vue 认为 key0 还是同一个节点，于是复用原来 A 的 DOM 原地 patch 成 B。文本更新了，但输入框这类 DOM 内部状态（用户输入、焦点、未受控状态）会残留，出现"第一行显示 B 的名字，输入框却留着 A 的值"。子组件同理：组件实例被复用，内部状态跟着位置走而非跟着数据走。

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

### 3.7 编译器与 Diff 协同（综合例题）

编译期负责「缩小搜索范围」，运行时 diff 负责「用最小成本完成更新」。用一个例子把两边串起来。

模板：

```html
<div>
  <h1>{{ title }}</h1>
  <p>这是静态描述</p>
  <ul>
    <li v-for="item in list" :key="item.id">{{ item.name }}</li>
  </ul>
</div>
```

编译产物（概念示意）：

```js
const _hoisted_1 = createVNode("p", null, "这是静态描述")  // 静态提升，只建一次

function render(_ctx) {
  return createBlock("div", null, [
    createVNode("h1", null, _ctx.title, 1 /* TEXT */),  // 动态文本
    _hoisted_1,                                          // 静态，复用
    createBlock(Fragment, null, _ctx.list.map(item =>
      createVNode("li", { key: item.id }, item.name, 1 /* TEXT */)
    ), 128 /* KEYED_FRAGMENT */),                        // v-for 片段
  ])
}
```

编译期做的三件事：静态提升（`<p>` 只建一次）、PatchFlag（`h1`/`li` 标 `TEXT=1`）、Block Tree（根 `div` 的 `dynamicChildren = [h1, ul片段]`，静态 `<p>` 不在其中）。

假设更新为 `title = "Hi"`，`list` 从 `[{id:1,'A'},{id:2,'B'},{id:3,'C'}]` 变为 `[{id:1,'A'},{id:3,'C'},{id:2,'B2'}]`，运行时 diff 分三层：

1. **Block 遍历**：只遍历根 Block 的 `dynamicChildren = [h1, ul]`，静态 `<p>` 一步不走。
2. **单节点 PatchFlag**：`h1` 命中 `TEXT=1` → 只更新文本 `Hello → Hi`，不比较 props/children。
3. **v-for 片段走 LIS**：keys `[1,2,3] → [1,3,2]`，头同步 `1==1`，中间 `[2,3]→[3,2]`，`newIndexToOldIndexMap=[3,2]`，LIS 保留 id3，只移动 id2 一次；id2 的 `name` 变了（`B→B2`）再命中 `TEXT` 更新文本。

最终 DOM 操作：静态 `<p>` 跳过、`<h1>` 改文本、`<li id=1>` 不动、`<li id=3>` 不动、`<li id=2>` 移动 1 次 + 改文本。

**一句话总结：** 编译期（静态提升 + PatchFlag + Block Tree）缩小 diff 范围，运行时（Block 遍历 + PatchFlag 局部 patch + LIS 最少移动）用最小成本完成更新——两者叠加才是「Vue3 比 Vue2 快」的完整答案。

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

**nextTick vs requestAnimationFrame vs requestIdleCallback（面试对比）：**

| API | 执行时机 | 优先级 | 典型用途 | 兼容性 |
|---|---|---|---|---|
| nextTick | 微任务，Vue 更新队列 flush 后立即执行 | 高（本轮事件循环内） | 改完数据马上读最新 DOM | 所有环境（含 SSR） |
| requestAnimationFrame | 下一帧重绘前，与刷新率同步 | 中（跟帧走） | 动画、帧同步 DOM 读写 | 全平台 |
| requestIdleCallback | 一帧渲染完成后的空闲期 | 低（可能不执行） | 埋点、日志、大任务切片 | Safari 不支持，生产需 polyfill |

一帧内的大致时间线：

```
宏任务（事件回调）
  → 微任务（nextTick 在这一层）
  → requestAnimationFrame 回调
  → 样式计算 / 布局 / 绘制
  → requestIdleCallback 回调（有空闲才执行）
  → 下一个宏任务
```

**为什么 nextTick 不用 rAF / rIC？** nextTick 要保证"DOM 更新后立刻回调"，微任务排在 Vue 的批量更新（同样是微任务）之后立即执行，确定性最强；rAF 与刷新率绑定，且非浏览器环境（SSR）不可用；rIC 优先级太低可能一直不执行，无法满足"必须拿到更新后 DOM"的场景。

### 5.2 异步更新队列

```
同一个 tick 内多次修改同一个数据，只会触发一次更新：

count.value++  // 触发 scheduler，将更新加入微任务队列
count.value++  // 同一个 tick，effect 已在队列中，不会重复添加
count.value++  // 合并为一次更新
nextTick(() => { /* 这里拿到最终值 3 */ })
```

### 5.3 Vue2 vs Vue3 调度器对比（提升点）

两者都有 `nextTick`，核心思想一样（异步队列 + 去重 + 父先子后），但 Vue3 做了三点升级：

**① nextTick 底层实现**

- Vue2：兼容 IE，用降级链 `Promise → MutationObserver → setImmediate → setTimeout`；
- Vue3：放弃 IE，直接用原生 `Promise.then`：

```js
const resolvedPromise = Promise.resolve()
function nextTick(fn) {
  return (currentFlushPromise || resolvedPromise).then(fn)
}
```

**② 调度粒度：引入 `flush` 选项**

Vue2 只有 `sync: true` 这种简单控制；Vue3 每个 effect 可以指定刷新时机：

| flush | 时机 | 场景 |
|-------|------|------|
| `pre`（默认） | 组件渲染前 | watch 默认 |
| `post` | 组件渲染后（能拿最新 DOM） | `watchEffect({ flush: 'post' })`、操作 DOM |
| `sync` | 同步执行 | 极少数需立即响应 |

**③ 队列管理更严谨**

`flushJobs` 除了去重、按 id 排序（父先于子），还多了**递归保护**（flush 期间新增 job 的处理）；响应式底层从 watcher 换成 effect，调度更轻量。

**一句话：** nextTick 的概念和用途没变，变的是「实现（原生 Promise）、粒度（flush 时机）、队列（更严谨）」。

---

## 六、组件通信与内置组件原理

### 6.1 props / emit / attrs / expose 模型

- props 是单向数据流：父传子，子组件不能直接改；props 对象本质是 shallowReadonly，修改会告警
- emit 用于子 → 父：`defineEmits(['update:title'])` 声明后 `emit('update:title', v)`；Vue3 中不再有 `$on / $off` 事件总线
- attrs：未被子组件声明为 props/emits 的属性与监听器（Vue3 中事件监听器也在 attrs 里）；`inheritAttrs: false` 可控制是否自动落到根节点
- expose：`defineExpose()` 明确暴露给父组件通过模板 ref 访问的能力，其余一律私有（Vue3 默认不暴露实例上的所有内容）

**一句话模型：** props 向下、emit 向上、provide/inject 穿透、slots 内容分发、ref + expose 命令式访问。

### 6.2 provide / inject 原理

- provide 把值挂到当前组件实例的 `provides` 对象上；inject 沿组件实例链向上查找（源码利用 provides 对象间的原型链继承：子实例 provides 以父实例 provides 为原型，找不到 key 就沿原型链继续）
- **provide/inject 本身不提供响应式**：它只是值传递机制。provide 普通对象，后代拿到同一份对象但不会被追踪，根组件整体替换新对象也不会通知后代；要响应式必须 provide ref/reactive 本身，后代读取时 track、修改时 trigger
- **传引用不复制**：provide 对象时，后代拿到的是同一个引用（`injected === provided` 为 true），不会深拷贝；所以子组件修改普通对象的属性，父组件的数据也会跟着变（只是不触发更新）
- **重新 provide 不会更新旧引用**：inject 在子组件 setup 时读取一次并持有引用；provide 方换成新对象重新 provide 后，已注入的子组件仍持有旧引用，只有响应式对象内部属性变化才能驱动更新
- inject 找不到 key 时返回默认值（`inject(key, default)`）否则为 undefined；中间组件是否 provide 不影响查找
- 应用级注入：`app.provide(key, value)`，所有组件可注入
- 适用场景：主题、用户信息、国际化、依赖注入式配置

### 6.3 keep-alive 原理（LRU 缓存）

- keep-alive 不渲染真实元素，而是拦截组件 vnode，缓存 vnode 及其子树（背后挂着组件实例和 DOM），实例不销毁只是暂停渲染
- 命中缓存：不重新创建组件实例，直接复用 vnode 和 DOM，触发 onActivated
- 淘汰策略（LRU 内部机制）：内部用 `cache`（存 vnode）+ `keys`（维护访问顺序）两个 Map；每次命中/缓存时先把 key delete 再 set 排到队尾；超过 `max` 时淘汰 keys 的第一个 key（最久未使用），并真正卸载该组件（触发 onUnmounted）
- include / exclude 按组件名控制缓存名单；`<script setup>` 组件需 `defineOptions({ name: 'Xxx' })` 才有名字；常与 `<component :is>` 配合
- 生命周期：首次挂载 `onMounted → onActivated`；切走触发 `onDeactivated`（不触发 onUnmounted）；切回触发 `onActivated`（不触发 onMounted）；被 LRU 淘汰时才触发 `onUnmounted`
- **面试话术：** 本质是"组件实例级缓存 + LRU 淘汰"，所以能保留滚动位置、输入内容和内部状态

### 6.4 Teleport 原理与用法

**核心：** Teleport 拆开"渲染位置"和"逻辑归属"两件事——DOM 挂到 `to` 指定的节点，组件逻辑（props、emit、provide/inject、生命周期、插槽）仍按原组件树走。

```vue
<template>
  <div class="page">
    <!-- 逻辑上：modal 仍是 page 的子组件 -->
    <Teleport to="body">
      <div class="modal">
        <button @click="close">关闭</button>
      </div>
    </Teleport>
  </div>
</template>
```

**三个常用属性：**

- `to`：CSS 选择器（如 `"#modal"`、`"body"`）或真实 DOM 元素；多个 Teleport 指向同一目标时按顺序追加
- `disabled`：为 true 时禁用传送，内容留在原地（移动端回退内嵌布局）
- `defer`（Vue 3.5+）：目标元素稍后由 Vue 渲染也能挂载；默认情况下挂载时目标必须已存在

**典型场景：** Modal、Toast、Dropdown、Tooltip、全屏遮罩——避免被父级 `overflow: hidden`、`transform`、低 `z-index` 裁剪或覆盖。

**事件冒泡的面试细节：**

- 组件逻辑层：props、emit、provide/inject、生命周期全部保留，和原来一样
- 原生 DOM 事件层：真实 DOM 上的事件冒泡（如 click）遵循**挂载后的 DOM 结构**——Teleport 到 body 后，内容不会经过原父组件的真实 DOM 节点，依赖"点击子元素冒泡到父元素"的链路会断

**一句话：** 组件树不动，DOM 树搬家。

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

### 2026-08-14 模拟面试暴露的易混淆点

- **computed vs watch 不是"有没有返回值"**：computed 是同步纯函数 + 缓存 + 懒计算，适合派生状态；watch 是副作用，适合异步 / DOM / 防抖 / old-new 值。computed 的 getter 返回 Promise 不会自动 await，也不会触发更新，正确做法是 watch + ref 或 VueUse `computedAsync`
- **shallowRef 为什么深层修改不触发**：只对 `.value` 做劫持，内部对象没有被 Proxy 代理；需要手动触发时用 `triggerRef`
- **reactive 重新赋值会丢响应**：因为新对象没被 Proxy 包装；`ref` 通过替换 `.value` 天然规避这个问题
- **v-model:title = `title` prop + `update:title` 事件**；`defineModel('title')` 只是把两者封装成可读写 ref，编译后仍是 prop + emit
- **index 作 key 的经典现场**：头部插入时，新 index 0 复用旧 index 0 的组件实例，输入框残留旧数据状态，形成"张冠李戴"

### 2026-08-23 模拟面试暴露的盲区（第 9 轮）

- **"劫持"≠"依赖收集"（术语错误）**：Vue2 初始化时递归做的是劫持（给属性加 getter/setter），是纯初始化开销；依赖收集发生在运行时读取属性、触发 getter 之后。未读取的属性没有依赖记录。别把初始化开销说成"都进了依赖池"
- **惰性代理的时机**：`reactive()` 执行时只代理最外层对象；嵌套对象在被 get 访问到的那一刻才递归包装（配合 proxyMap 缓存防重复）。这是 Vue3 相对 Vue2 性能收益的最大来源——未被视图消费的深层数据零响应式开销
- **dep 里存的是 effect，不是 DOM 元素**：effect = 渲染函数 / computed 求值 / watch 回调。链路是属性变化 → trigger 找 effect → 执行 effect → 渲染 effect 间接产出 vnode → patch。effect ≠ 元素
- **WeakMap 回收的是数据对象（target），不是视图元素**：组件销毁 → target 失去外部强引用 → targetMap 弱引用不阻止回收 → 整条 depsMap→dep 链失去入口被 GC。普通 Map 会反向"续命"造成内存泄漏
- **Proxy 的局限 + Vue3 的补救**（2026 美团真题）：基本类型不能代理 → `ref`；代理对象与原对象 `===` 不等 → `toRaw` + proxyMap 缓存；**Map/Set 的方法调用（如 `map.set`）走不到 get/set 拦截** → Vue3 在 get 拦截器里检测集合方法并返回包装版本（内部 `toRaw` 操作原对象 + 手动 track/trigger）——最后这条是高级分水岭
- **PatchFlag / BlockTree 极简记忆（30 秒版）**：编译器像提前预习的考生——永远不变的节点（静态提升）vnode 只造一次、patch 直接跳过（HOISTED）；会变的节点列成名单（dynamicChildren），更新时只看名单；名单上每人一张"病历卡"（PatchFlag：TEXT=1 / CLASS=2 / STYLE=4），patch 只查卡上那一项。v-if/v-for 是结构边界，产生新 block（BlockTree）保证正确性
- **watch 竞态的内建解法是 onCleanup**（回调第三个参数 / 3.5 全局 onWatcherCleanup）：注册的清理函数在下一次回调触发前、watcher 停止（含组件卸载）时自动执行。防抖的 clearTimeout + 竞态的 AbortController 都挂在这上面，三个需求（防抖/竞态/卸载清理）一个钩子全解决。loading 标志和 old/new 比对都**不能**解决竞态——竞态是响应到达顺序问题。备用解法：闭包版本号 token（`if (id !== requestId) return`，旧响应自我作废）
- **defineModel 的"穿透"是一次事件往返**：set → emit('update:modelValue') → 父组件更新自己的变量 → 新 prop 流回子组件 → get 读到新值（内部维护 local value 兜底 prop 往返延迟）。单向数据流没有被打破——子组件从未直接改父状态
- **toRaw/markRaw/proxyMap 详解已补进 1.7 节**：核心记忆点——toRaw 是只读逃生门（改 raw 不触发更新、只脱一层）；ECharts/G6 实例必须 markRaw 或普通变量持有（ref 内部对对象也会调 reactive）；proxyMap 保证同一原对象全局唯一代理（`reactive(reactive(x)) === reactive(x)`）

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
- 掘金：Vue3 模板编译优化——Patch Flags 与 Block Tree 深度解析（2025-09）— https://juejin.cn/post/7555053579033624618
- php.cn：Vue3 是如何处理动态节点的？深入理解 Block 收集动态子代的机制（2026-04）— https://www.php.cn/faq/2323135.html
- 掘金/搜狐：Vue2 到 Vue3——性能飞跃与 Diff 算法革命（2026-03/04）— https://jishuzhan.net/article/2039234008226729985
- php.cn：动态节点标记 Patch Flags——Diff 算法的加速钥匙（2026-07）— https://www.php.cn/faq/2833002.html
- php.cn：Vue 渲染流程中异步任务的调度优先级（2026-07）— https://www.php.cn/faq/2859386.html
- 掘金：vue2 和 vue3 的 nextTick 实现的不同方式 — https://juejin.cn/post/6888227890618433549
