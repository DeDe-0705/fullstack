# HTML / CSS / ES6 / JavaScript 基础

> 高级前端面试中，基础题答不好是致命减分项。本文覆盖四个方向的高频考点。

---

## 一、HTML

### 1.1 HTML5 新特性（面试必问）

```
✅ 语义化标签：<header> <nav> <main> <article> <section> <aside> <footer>
✅ 多媒体：<video> <audio>（原生支持，不再依赖 Flash）
✅ 表单增强：新 type（email/date/range/number）、placeholder、required、pattern
✅ Canvas / SVG：2D 绘图
✅ 存储：localStorage / sessionStorage
✅ 通信：WebSocket、Server-Sent Events（SSE）
✅ Web Worker
✅ History API（pushState / replaceState — SPA 路由的基础）
```

### 1.2 语义化标签的价值

**不是"看起来好看"，有实际收益：**

1. **SEO**：搜索引擎读懂你的页面结构，排名更高
2. **可访问性（a11y）**：屏幕阅读器能正确导航，视障用户可用
3. **代码可读性**：`<nav>` 比 `<div class="nav">` 更清晰，团队维护成本低

### 1.3 `defer` vs `async`（再强调一次）

| | 普通 script | defer | async |
|------|---------|-------|-------|
| 下载 | 阻塞解析 | 并行 | 并行 |
| 执行 | 立即 | DOM 解析完、按序 | 下载完立即、乱序 |
| 场景 | — | 依赖 DOM 的脚本 | 独立脚本（统计、广告） |

### 1.4 `src` vs `href`

- `src`（source）：**替换当前元素**。`<script src>`、`<img src>`、`<iframe src>`。浏览器暂停解析，等资源加载。
- `href`（hyper reference）：**建立关联**。`<link href>`、`<a href>`。浏览器不暂停解析，并行加载。

### 1.5 `<!DOCTYPE html>` 与两种渲染模式

**作用：** 告诉浏览器用**标准模式（standards mode）**渲染页面。HTML5 下写法唯一、固定，没有版本号。

**缺失或写错 → 怪异模式（quirks mode）**，模拟 IE5 时代的行为。核心区别：

1. **盒模型（最常考）**：怪异模式下 `width` 包含 `padding` 和 `border`，等价于所有元素默认 `box-sizing: border-box`；标准模式默认 `content-box`，`width` 只算内容区。
2. **行高与行内元素**：怪异模式下 `line-height` 继承、行内元素垂直布局不同（如图片底部间隙）。
3. **表格与百分比布局**：单元格尺寸、百分比宽度计算方式有差异。

**面试话术：** "`<!DOCTYPE html>` 决定浏览器用哪套渲染规则，写错或不写，盒模型就先错一半。"

---

## 二、CSS

### 2.1 盒模型

```css
/* 标准盒模型（默认） */
box-sizing: content-box;
/* width = content 宽度，padding/border 额外加 */

/* IE/替代盒模型 */
box-sizing: border-box;
/* width = content + padding + border（更直观） */
```

**面试话术：** "开发中全局设 `box-sizing: border-box`，这样 `width: 100px` 就是盒子的最终宽度，不用心算 padding。" 几乎所有现代 CSS Reset 都包含这个规则。

### 2.2 BFC（块级格式化上下文）

**面试高频考点。** BFC 是一个独立的渲染区域，内部布局不影响外部。

```
触发 BFC 的条件：
  - float 不为 none
  - position: absolute / fixed
  - display: inline-block / flex / grid / flow-root
  - overflow: hidden / auto / scroll（最常用）

BFC 解决什么问题：
  1. 外边距折叠（两个 BFC 的 margin 不重叠）
  2. 清除浮动（BFC 包裹浮动子元素，父元素高度不塌陷）
  3. 防止文字环绕浮动元素
```

```css
/* 经典场景：父元素包含浮动子元素 → 高度塌陷 */
.parent {
  overflow: hidden;  /* 触发 BFC → 自动包裹浮动子元素 */
}
```

### 2.3 垂直居中（面试手撕）

```css
/* flex 方案（最推荐） */
.parent {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* grid 方案 */
.parent {
  display: grid;
  place-items: center;  /* align-items + justify-items 的简写 */
}

/* 绝对定位 + transform（不知道宽高时） */
.child {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* 绝对定位 + margin（知道宽高时） */
.child {
  position: absolute;
  top: 0; bottom: 0; left: 0; right: 0;
  margin: auto;
  width: 200px;
  height: 100px;
}
```

**各方案适用场景与坑（面试追问重点）：**

| 方案 | 适用场景 | 坑 |
|------|---------|-----|
| flex | 通用首选 | 影响父容器子项布局；`justify-content` vs `align-items` 别记反 |
| grid | 二维布局顺带居中 | `place-items` 对齐"项目在网格区域内"；`place-content` 对齐网格轨道本身，别混 |
| absolute + transform | 子元素宽高未知 | `top/left: 50%` + `translate(-50%,-50%)`；`transform` 会创建层叠上下文 |
| absolute + margin | 子元素宽高确定 | 四边 0 是拉伸 + `margin: auto` 居中，**与 transform 无关**，两套不能混用 |
| 固定宽 + `margin: 0 auto` | 仅水平居中 | 垂直方向普通文档流无剩余空间可分，`margin: auto` 无效 |
| table-cell + vertical-align | 兼容旧浏览器 | table-cell 不响应 margin，需 `display: table` 包裹 |
| line-height = height | 单行文本 | 换行/多行立即失效 |

**padding 不是通用居中方案：** 只在父容器和子元素尺寸都固定且不变时手动算间距，一变即失效，别当面试方案说。

### 2.4 `flex: 1` 是什么的简写？

```css
flex: 1 = flex-grow: 1 + flex-shrink: 1 + flex-basis: 0%
/*  占满剩余空间      空间不够时缩小       初始大小为0 */

/* ⚠️ flex-basis: 0% 是关键——忽略内容宽度，从零按比例分配 */
/* 如果用 flex: auto (= flex: 1 1 auto)，内容会先占宽度，剩余才分配 */
```

**两个元素分配空间：** `flex: 1` 和 `flex: 2` → 剩余空间按 1:2 分。

### 2.5 盒模型计算（面试口算题）

```
标准盒 (content-box, 默认)：
  width: 200px; padding: 20px; border: 5px
  → 实际占据 = 200 + 20×2 + 5×2 = 250px

IE盒 (border-box)：
  width: 200px; padding: 20px; border: 5px
  → 实际占据 = 200px（width 已包含 content + padding + border）
```

```css
/* 全站统一 border-box（几乎所有 CSS Reset 都包含） */
*, *::before, *::after { box-sizing: border-box; }
```

| 触发 | 属性 |
|------|------|
| 重排 (Layout) | width, height, margin, padding, left, top, display, position, font-size |
| 重绘 (Paint) | color, background, border-color, box-shadow, visibility |
| 仅合成 (Composite) | transform, opacity |

### 2.6 `rem` vs `em` vs `vw/vh`

| 单位 | 相对谁 |
|------|--------|
| `rem` | 根元素 `<html>` 的 font-size |
| `em` | **父元素**的 font-size（嵌套会叠加） |
| `vw/vh` | 视口宽/高（1vw = 视口宽度 1%） |

**移动端适配常用：** `html { font-size: calc(100vw / 3.75) }` → iPhone 6 设计稿 1rem = 100px。

---

## 三、ES6+

### 3.1 `let` / `const` / `var` 区别

| | var | let | const |
|------|-----|-----|-------|
| 作用域 | 函数级 | 块级 {} | 块级 {} |
| 变量提升 | 是（undefined） | 是（暂时性死区 TDZ） | 是（TDZ） |
| 重复声明 | 允许 | ❌ | ❌ |
| 重新赋值 | 允许 | 允许 | ❌ |
| 必须初始化 | 否 | 否 | **是** |

**暂时性死区（TDZ）：** `let/const` 在声明前使用会报 `ReferenceError`，不是因为不存在，而是进入了"死区"。

**作用域差异（面试重点）：**

```js
// var = 函数作用域
function fn() {
  if (true) { var x = 1 }
  console.log(x)  // 1 — var 穿透块级 {}
}

// let/const = 块级作用域
function fn() {
  if (true) { let y = 1 }
  console.log(y)  // ReferenceError — y 只在 {} 内有效
}

// 经典 for 循环差异
for (var i = 0; i < 3; i++) { setTimeout(() => console.log(i), 0) }  // 3,3,3
for (let i = 0; i < 3; i++) { setTimeout(() => console.log(i), 0) }  // 0,1,2
// for (let i) 每轮迭代创建新的词法环境 + 新的 i 绑定（继承上一轮值并 i++），
// 回调闭包捕获的是各自迭代的绑定；var 则是同一个变量、所有回调共享引用
```

**var 保留时的经典修复（面试手撕）：**

```js
// IIFE：每轮立即调用，形参 j 是本次调用作用域内的独立绑定
for (var i = 0; i < 3; i++) {
  (function (j) {
    setTimeout(() => console.log(j), 0)
  })(i)
}

// bind：调用 bind 那一刻把 i 的值"快照"进新函数的参数列表
for (var i = 0; i < 3; i++) {
  setTimeout(function (j) { console.log(j) }.bind(null, i), 0)
}
// ⚠️ bind 在这里的核心是"预置参数"，null 只是占位 this，回调里根本不用 this
```

**防面试官挖坑：** 不要答"var 保留就改成 async/await 串行"。for 循环**永远不会自动等待异步**（除非循环体内显式 await Promise）；原题结构加 async/await 输出仍是 3 个 3。await 串行只是改变执行时序，没有修复闭包捕获。

### 3.2 箭头函数 vs 普通函数

| | 普通函数 | 箭头函数 |
|------|---------|---------|
| this | 调用时确定（谁调用指向谁） | 定义时确定（继承外层词法作用域） |
| arguments | ✅ 有 | ❌ 没有（用剩余参数代替） |
| 构造函数 | ✅ 可用 new | ❌ 不能用 new |
| prototype | ✅ 有 | ❌ 没有 |

```js
// 经典坑
const obj = {
  name: 'Alice',
  fn: () => console.log(this.name),  // this 指向外层，不是 obj
  fn2() { console.log(this.name) }   // this 指向 obj
}
obj.fn()   // undefined（外层是全局/undefined）
obj.fn2()  // 'Alice'
```

### 3.2.1 高频追问：对象方法里箭头函数的 this 为什么不是对象？

**核心原因：对象字面量 `{}` 不构成词法环境（作用域）**，只是属性集合。箭头函数捕获的是"定义位置外层作用域链上的 this"，对象不在作用域链上，所以捕获到的是**全局/模块作用域的 this**：

```js
const arrowObj = {
  name: 'arrowObj',
  callName: () => {
    console.log(this?.name)  // undefined
  },
}
arrowObj.callName()
```

全局 this 的值取决于运行环境（面试说清环境才算完整）：

| 环境 | 全局顶层 this |
|------|--------------|
| 浏览器普通 `<script>`（非严格） | `window`（`window.name` 通常为空） |
| ES Module / Vite / 严格模式 | `undefined` |
| Node.js CommonJS | `module.exports`（空对象） |

**对比：** 箭头函数定义在普通函数内时，捕获的是该函数**调用时**的 this：

```js
const obj = {
  name: 'obj',
  outer() {
    const inner = () => console.log(this.name)
    inner()
  },
}
obj.outer()  // 'obj' — inner 捕获 outer 的 this
```

**面试话术：** "箭头函数的 this 沿作用域链向上找最近的非箭头函数作用域或全局，对象字面量不在作用域链上，所以永远无法提供 this；想让方法 this 指向对象，必须用普通函数/方法简写。"

### 3.3 解构、展开、剩余

```js
// 解构
const { name, age } = user
const [first, second] = arr

// 展开（浅拷贝）
const obj = { ...oldObj, newKey: 'val' }
const arr = [...oldArr, 4, 5]

// 剩余
const { a, ...rest } = { a: 1, b: 2, c: 3 }  // rest = {b:2, c:3}
const [first, ...rest] = [1, 2, 3]            // rest = [2, 3]
function fn(a, ...args) {}                     // args 收集剩余参数
```

### 3.4 Map / Set / WeakMap / WeakSet

```js
// Map — 键可以是任意类型（对象也能当 key）
const map = new Map()
map.set(obj, 'value')
map.get(obj)           // 'value'

// Set — 唯一值集合
const set = new Set([1, 2, 2, 3])  // Set(3) {1, 2, 3}

// WeakMap — 键必须是对象，弱引用（不阻止 GC）
const wm = new WeakMap()
wm.set(obj, 'data')    // obj 被回收时，WeakMap 中的条目自动清除
// 适合：DOM 元素关联数据、私有属性

// WeakSet — 只存对象，弱引用
```

### 3.5 Proxy（Vue3 响应式的基础）

```js
const obj = { name: 'Alice', age: 25 }
const proxy = new Proxy(obj, {
  get(target, key) {
    console.log(`读取 ${key}`)
    return target[key]
  },
  set(target, key, value) {
    console.log(`设置 ${key} = ${value}`)
    target[key] = value
    return true
  }
})

proxy.name       // → 读取 name → 'Alice'
proxy.age = 30   // → 设置 age = 30
```

### 3.6 Reflect

`Reflect` 是操作对象的"标准化工具"，和 Proxy 的 handler 方法一一对应：

```js
Reflect.get(obj, 'name')       // 替代 obj.name
Reflect.set(obj, 'age', 30)    // 替代 obj.age = 30
Reflect.has(obj, 'key')        // 替代 'key' in obj
Reflect.deleteProperty(obj, 'key')  // 替代 delete obj.key
```

**为什么需要 Reflect？** `Object.defineProperty` 操作失败时抛异常，`Reflect.defineProperty` 返回 true/false，配合 Proxy 更安全。

---

## 四、JavaScript 核心

### 4.1 原型链

```js
// 查找规则：obj → obj.__proto__ → obj.__proto__.__proto__ → ... → null
function Person(name) { this.name = name }
Person.prototype.say = function() { console.log(this.name) }

const p = new Person('Alice')
p.say()  // 'Alice'
// p.__proto__ === Person.prototype
// Person.prototype.__proto__ === Object.prototype
// Object.prototype.__proto__ === null  ← 终点

// ⚠️ 别搞混两类原型链：

// 1. 实例的原型链（普通对象）
p → Person.prototype → Object.prototype → null

// 2. 函数本身的链（Person 是函数对象）
Person → Function.prototype → Object.prototype → null

// Person.prototype 是普通对象（new Object()），
// 它的 __proto__ 指向 Object.prototype，不是 Function.prototype
```

### 4.2 `this` 指向（面试大坑）

```js
// 5 种绑定规则（记住优先级：new > 显式 > 隐式 > 默认）

// 1. 默认绑定：严格模式 undefined，非严格模式指向全局
function fn() { console.log(this) }

// 2. 隐式绑定：谁调用指向谁
obj.method()  // this = obj

// 3. 显式绑定：call/apply/bind 强制指定
fn.call(ctx, a, b)     // 立即调用
fn.apply(ctx, [a, b])  // 立即调用，参数传数组
const bound = fn.bind(ctx)  // 返回新函数，this 永久绑定

// 4. new 绑定：this = 新创建的实例
new Person()  // this = {}

// 5. 箭头函数：定义时继承外层词法 this，无法被 call/apply/bind 改变

// 常见踩坑：
// ❌ Vue Options API 中 methods 用箭头函数 → this 不指向组件实例
// ❌ React Class 中事件回调没 bind → this 为 undefined
// ✅ Vue3 Composition API 的 setup() 中没有 this，天然避开这些问题
```

### 4.2.1 bind / call / apply 高频追问（手写前先背熟）

**三者核心区别：**

| 方法 | 执行方式 | 参数形式 | 典型用途 |
|------|---------|---------|---------|
| call | 立即调用 | 参数列表 `fn.call(ctx, a, b)` | 借用方法、透传参数 |
| apply | 立即调用 | 数组 `fn.apply(ctx, [a, b])` | 配合 arguments/数组展开 |
| bind | 返回新函数 | 参数可分次传入（柯里化） | 固定 this + 预置参数 |

**bind 底层原理：** 返回的绑定函数是"异质函数对象"，通过内部槽保存三样东西——`[[BoundThis]]`（固定的 this）、`[[BoundTargetFunction]]`（原函数）、`[[BoundArguments]]`（预置参数）。**这些是内部槽，不是词法环境**，不参与作用域链。面试时说"bind 把 this 存进词法环境"是错的。

**高频追问 1：多次 bind 会怎样？** this 以**第一次 bind** 的对象为准，后续 bind 的 this 被忽略，但**参数会继续拼接**：

```js
const fn = function (a, b) { return [this.x, a, b] }
const bound1 = fn.bind({ x: 1 }, 10)
const bound2 = bound1.bind({ x: 99 }, 20)
bound2()  // [1, 10, 20] — this 还是 { x: 1 }，参数拼接
```

**高频追问 2：箭头函数能被 bind 吗？** 能调用、不报错，但传入的 `thisArg` **永远无效**——箭头函数没有自己的 this，用的是定义时捕获的词法 this。所以 bind 箭头函数只剩"预置参数"一个用途。call/apply 同理。

**高频追问 3：bind 的目标必须有 prototype 吗？** 不需要。bind 只要求目标是**可调用对象（callable）**。箭头函数、对象方法简写都没有 `prototype`，照样能 bind。

**高频追问 4：传 null/undefined 给 call/apply/bind？** 非严格模式下 this 被替换为全局对象（window/globalThis）；**严格模式下保持 null/undefined**。

**高频追问 5：new 一个 bind 出来的函数？** `new boundFn()` 等价于 `new targetFn()`：绑定的 this 被忽略（new 会创建新实例作为 this），但**预置参数仍会传入**构造函数。手写 bind 必须处理这一点。

**面试话术：** "bind 通过内部槽保存原函数、this 和预置参数并返回绑定函数；绑定函数的 this 永久固定，再 bind 只拼参数；箭头函数可 bind 但 this 无效；bound 函数可被 new，此时 this 被忽略而参数保留。"

### 4.2.2 new 机制（this 优先级最高）

**四步机制：** 创建空对象 → 原型链接到 `Constructor.prototype` → 执行构造函数并把 this 绑定到新对象 → 构造函数返回对象/函数则用它，否则返回新对象。

```js
function Foo() {
  this.name = 'foo'
  return { name: '覆盖了' }   // 返回对象 → new Foo().name === '覆盖了'
}
function Bar() {
  this.name = 'bar'
  return 42                   // 返回基本类型 → 被忽略，new Bar().name === 'bar'
}
```

**高频追问：**

1. **`new.target`**：new 调用时指向构造函数本身，普通调用为 `undefined`；可用来兼容"忘写 new"的场景。
2. **优先级**：new > 显式（call/apply/bind）> 隐式（obj.fn()）> 默认。所以 `new boundFn()` 时 bind 的 this 被忽略。
3. **不能 new 的函数**：箭头函数（无 `[[Construct]]` 内部方法）、对象方法简写；class 相反——**只能** new 调用。
4. 手写实现见 `手写代码.md` 第八章。

### 4.3 闭包

```js
function createCounter() {
  let count = 0  // 被内部函数引用，不会被 GC
  return {
    increment() { return ++count },
    get() { return count }
  }
}

const c = createCounter()
c.increment()  // 1
c.increment()  // 2
// count 是私有变量，外部无法直接访问
```

**面试话术：** "闭包就是一个函数记住并访问了它的词法作用域，即使这个函数在外部被调用了。常见应用：模块模式、柯里化、防抖节流的 timer 变量。"

**高频追问 1：闭包保存的是什么？** 是**词法作用域里的状态变量**（防抖的 timer、节流的上次执行时间、计数器的 count），不是"上下文"——JS 里"上下文"专指 this/执行上下文，说错会被扣分。

**高频追问 2：为什么用闭包而不是全局变量？** 全局变量会让多个实例（如两个输入框）**共享同一份 timer 互相干扰**，且任何代码都能修改；闭包把状态锁在函数私有作用域，每次调用工厂函数生成独立状态。

**高频追问 3：防抖/节流里 this 怎么传？** `setTimeout` 普通函数回调非严格模式 this 指向 window、严格模式 undefined。修复：回调用箭头函数捕获词法 this，或提前 `const self = this`；实现时用 `fn.apply(this, args)` 把 this 和参数透传给原函数。完整实现见 `手写代码.md`。

### 4.4 深拷贝 vs 浅拷贝

```js
// 浅拷贝：只复制第一层
const obj = { a: 1, b: { c: 2 } }
const shallow = { ...obj }      // 或 Object.assign
shallow.b.c = 3
obj.b.c  // → 3（嵌套对象共享引用）

// 深拷贝方案：
JSON.parse(JSON.stringify(obj))    // 简单但不支持函数/Date/循环引用
structuredClone(obj)               // 现代浏览器原生支持
// 或者递归 + WeakMap（手写代码.md 里有）
```

### 4.5 数据类型检测

```js
typeof null           // 'object' ← 历史 Bug（JS 前三位标志位）
typeof []             // 'object' ← 不精确
typeof function(){}   // 'function'

[] instanceof Array       // true
// ⚠️ instanceof 局限性：跨 iframe 失效！
// iframe 有自己的 Array/Function/Object 构造函数
// 主窗口的 Array.prototype ≠ iframe 的 Array.prototype
// → new iframeWindow.Array() instanceof Array  → false

Array.isArray(arr)         // true ← ES6 最推荐
Object.prototype.toString.call([])  // '[object Array]' ← 最可靠
```

### 4.6 `==` vs `===` 的类型转换

```
=== 严格相等：类型不同直接 false
==  抽象相等：类型不同时尝试转换

记住几个坑：
null == undefined        // true
null === undefined       // false
[] == false              // true（[]先转''再转0，false转0）
'0' == false             // true
'0' === false            // false
```

**开发中永远用 `===`，除非你明确需要 `null == undefined` 的宽松判断。**

---

## 五、面试速查

| 问题 | 要点 |
|------|------|
| HTML5 新特性 | 语义化标签、video/audio、Canvas、WebSocket、localStorage |
| src vs href | src=替换(暂停解析), href=关联(不暂停) |
| BFC | 独立渲染区域，解决外边距折叠/高度塌陷/文字环绕 |
| 垂直居中 | flex/grid > absolute+transform > absolute+margin |
| flex: 1 是什么 | flex-grow:1 + flex-shrink:1 + flex-basis:0% |
| let/const/var | 块级/块级/函数作用域；TDZ；const 必须初始化 |
| 箭头函数 this | 定义时继承词法作用域，无法改变 |
| 闭包 | 函数记住词法作用域，timer/模块/柯里化 |
| Proxy 作用 | Vue3 响应式基础，拦截 13 种操作 |
| this 绑定优先级 | new > 显式(call/apply/bind) > 隐式(obj.fn) > 默认 |
| == vs === | === 永远用；== 有隐性转换，null==undefined 不常用 |
| typeof 缺陷 | typeof null='object', typeof [ ]='object' |
