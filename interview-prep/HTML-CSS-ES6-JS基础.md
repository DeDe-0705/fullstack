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
// let 每次迭代创建新的块级作用域，保留当前 i 的值
```

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
