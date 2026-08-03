# Wujie 核心机制：WebComponent + Proxy 代理

> **Wujie 的核心思想："运行时在 iframe，渲染在 Shadow DOM"。**
> 
> 它利用 iframe 提供独立的 JS 沙箱，再通过 Proxy 劫持 document、window 等对象，把子应用的 DOM API 重定向到 WebComponent 的 ShadowRoot 中。这样子应用始终认为自己运行在一个完整的页面里，而浏览器最终渲染的 DOM 却是在父应用中，实现了 **JS 沙箱隔离** 和 **页面无缝融合**。

---

## 零、Wujie 的三层设计

Wujie 的设计可以拆成三个层面：

| 层面 | 技术 | 作用 | 实现效果 |
|------|------|------|---------|
| **第一层** | iframe | 提供浏览器级 JS 沙箱 | 子应用的 JS 运行在独立的 window/document/history 环境中，与主应用完全隔离 |
| **第二层** | Shadow DOM | 承载真实渲染内容并隔离样式 | 子应用的 DOM 渲染在 ShadowRoot 中，样式不受主应用影响 |
| **第三层** | Proxy 代理 | 重定向 DOM API | 让运行在 iframe 中的子应用将渲染结果输出到 ShadowRoot |

**三层协同工作：**

```
子应用的 JS 代码
  ↓ (第一层：iframe 沙箱)
在 iframe 的 window/document 中执行
  ↓ (第三层：Proxy 代理 DOM API)
DOM 操作被重定向到 ShadowRoot
  ↓ (第二层：Shadow DOM 渲染)
最终渲染在父页面的 ShadowRoot 中
```

**核心机制：**

- **iframe**：子应用的 JS 代码在 iframe 的 window/document 中执行，享受浏览器级的 JS 沙箱隔离，全局变量、事件、定时器都独立。
- **Shadow DOM**：子应用的 DOM 最终渲染在 WebComponent 的 ShadowRoot 中，样式隔离，不影响主应用。
- **Proxy 代理**：Wujie 通过 Proxy 劫持子应用的 document/window，把 DOM API（如 getElementById、appendChild）重定向到 ShadowRoot，子应用无感知。

---

## 一、什么是 WebComponent

### 1.1 WebComponent 三件套

WebComponent 是浏览器原生的组件化方案，由三个技术组成：

| 技术 | 作用 | 示例 |
|------|------|------|
| **Custom Elements** | 自定义 HTML 标签 | `<wujie-app>` |
| **Shadow DOM** | 隔离的 DOM 树，样式和事件隔离 | `element.attachShadow({ mode: 'open' })` |
| **HTML Templates** | 可复用的 HTML 模板 | `<template>` |

### 1.2 Wujie 中的 WebComponent

```typescript
// Wujie 创建 WebComponent
class WujieApp extends HTMLElement {
  private shadowRoot: ShadowRoot
  
  constructor() {
    super()
    
    // 创建 Shadow DOM
    this.shadowRoot = this.attachShadow({ mode: 'open' })
    
    // Shadow DOM 内的 DOM 对外部不可见（隔离）
    // 外部 CSS 不会影响 Shadow DOM 内的样式（样式隔离）
    // 但事件可以穿透（通过 composed: true）
  }
  
  connectedCallback() {
    // 元素被挂载到 DOM 时触发
    console.log('Wujie app mounted')
  }
  
  disconnectedCallback() {
    // 元素被移除时触发
    console.log('Wujie app unmounted')
  }
}

// 注册自定义元素
customElements.define('wujie-app', WujieApp)

// 使用
const app = document.createElement('wujie-app')
document.body.appendChild(app)
```

### 1.3 Shadow DOM 的隔离特性

```html
<!-- 主应用 HTML -->
<body>
  <style>
    /* 主应用的样式 */
    div { color: red; }
  </style>
  
  <div>主应用的 div（红色）</div>
  
  <wujie-app>
    <!-- Shadow DOM 内的内容 -->
    #shadow-root
      <style>
        /* Shadow DOM 内的样式 */
        div { color: blue; }
      </style>
      <div>Shadow DOM 的 div（蓝色，不受主应用影响）</div>
  </wujie-app>
</body>
```

**Shadow DOM 的隔离规则：**

| 规则 | 说明 | 示例 |
|------|------|------|
| **DOM 隔离** | Shadow DOM 内的元素对外部不可见 | `document.querySelector('wujie-app div')` 找不到 Shadow DOM 内的 div |
| **样式隔离** | 外部 CSS 不影响 Shadow DOM 内的样式 | 主应用的 `div { color: red }` 不会影响 Shadow DOM 内的 div |
| **事件穿透** | Shadow DOM 内的事件可以冒泡到外部 | 点击 Shadow DOM 内的按钮，主应用可以监听到 click 事件 |

---

## 二、Wujie 如何用 WebComponent

### 2.1 Wujie 的双层架构

```
主应用 DOM
  └── <wujie-app>                    ← Custom Element
        └── #shadow-root (open)      ← Shadow DOM（承载子应用的 DOM）
              └── <div id="app">     ← 子应用的真实 DOM 渲染在这里
                    └── 子应用的组件树
        
  └── iframe (隐藏)                   ← 子应用的 JS 运行环境
        └── window/document           ← JS 沙箱隔离
```

**关键点：**
- **iframe**：提供 JS 沙箱隔离（window/document/history 独立）
- **Shadow DOM**：承载子应用的真实 DOM 渲染，提供样式隔离
- **DOM API 代理**：把子应用对 iframe document 的操作映射到 ShadowRoot

### 2.2 Wujie 的初始化流程

```typescript
// Wujie 初始化（简化版）
class Wujie {
  private webComponent: HTMLElement
  private shadowRoot: ShadowRoot
  private iframe: HTMLIFrameElement
  
  constructor(container: HTMLElement, url: string) {
    // 1. 创建 WebComponent
    this.webComponent = document.createElement('wujie-app')
    this.shadowRoot = this.webComponent.attachShadow({ mode: 'open' })
    
    // 2. 创建隐藏的 iframe（JS 沙箱）
    this.iframe = document.createElement('iframe')
    this.iframe.style.display = 'none'
    this.iframe.src = url
    document.body.appendChild(this.iframe)
    
    // 3. 代理子应用的 DOM API
    this.proxyDOMAPI()
    
    // 4. 挂载 WebComponent 到容器
    container.appendChild(this.webComponent)
  }
  
  private proxyDOMAPI() {
    const iframeWindow = this.iframe.contentWindow!
    const iframeDocument = this.iframe.contentDocument!
    
    // 代理子应用的 document
    // 详见下文 "三、Proxy 代理 DOM API"
  }
}
```

---

## 三、Proxy 代理 DOM API

### 3.1 为什么需要 Proxy 代理

**问题：** 子应用的 JS 运行在 iframe 中，但 DOM 需要渲染到 ShadowRoot。

```javascript
// 子应用的代码（运行在 iframe 的 JS 沙箱中）
const app = document.getElementById('app')
// ❌ 如果不代理，会在 iframe 的 document 中查找，找不到元素

app.innerHTML = '<h1>Hello</h1>'
// ❌ 如果不代理，会修改 iframe 的 DOM，父页面看不到
```

**解决方案：** 用 Proxy 代理子应用的 document，把 DOM 操作映射到 ShadowRoot。

```javascript
// 代理后
const app = document.getElementById('app')
// ✅ 实际查询 ShadowRoot 内的元素

app.innerHTML = '<h1>Hello</h1>'
// ✅ 实际修改 ShadowRoot 内的 DOM，父页面可见
```

### 3.2 Proxy 代理的实现

```typescript
// Wujie 的 Proxy 代理（简化版）
class DOMProxy {
  private iframe: HTMLIFrameElement
  private shadowRoot: ShadowRoot
  
  constructor(iframe: HTMLIFrameElement, shadowRoot: ShadowRoot) {
    this.iframe = iframe
    this.shadowRoot = shadowRoot
    
    this.setupProxy()
  }
  
  private setupProxy() {
    const iframeWindow = this.iframe.contentWindow!
    const iframeDocument = this.iframe.contentDocument!
    
    // 1. 代理 document.getElementById
    iframeDocument.getElementById = new Proxy(iframeDocument.getElementById, {
      apply: (target, thisArg, args) => {
        const [id] = args
        
        // 特殊情况：查询挂载点
        if (id === 'app' || id === 'root') {
          return this.shadowRoot.querySelector(`#${id}`)
        }
        
        // 其他情况：在 ShadowRoot 内查询
        return this.shadowRoot.querySelector(`#${id}`)
      }
    })
    
    // 2. 代理 document.querySelector
    iframeDocument.querySelector = new Proxy(iframeDocument.querySelector, {
      apply: (target, thisArg, args) => {
        const [selector] = args
        
        // 特殊情况：查询 body
        if (selector === 'body') {
          return this.shadowRoot.host  // 返回 WebComponent 本身
        }
        
        // 其他情况：在 ShadowRoot 内查询
        return this.shadowRoot.querySelector(selector)
      }
    })
    
    // 3. 代理 document.querySelectorAll
    iframeDocument.querySelectorAll = new Proxy(iframeDocument.querySelectorAll, {
      apply: (target, thisArg, args) => {
        const [selector] = args
        
        // 在 ShadowRoot 内查询
        return this.shadowRoot.querySelectorAll(selector)
      }
    })
    
    // 4. 代理 document.createElement
    iframeDocument.createElement = new Proxy(iframeDocument.createElement, {
      apply: (target, thisArg, args) => {
        const [tagName] = args
        
        // 创建元素（在 iframe 的 document 中创建，但后续会挂载到 ShadowRoot）
        const element = target.apply(thisArg, args)
        
        // 标记元素：后续 appendChild 时会挂载到 ShadowRoot
        element.__wujie_shadow_root__ = this.shadowRoot
        
        return element
      }
    })
    
    // 5. 代理 document.body
    Object.defineProperty(iframeDocument, 'body', {
      get: () => {
        // 返回一个代理对象，拦截 appendChild 等操作
        return new Proxy(this.shadowRoot, {
          get: (target, prop) => {
            if (prop === 'appendChild') {
              return (element: HTMLElement) => {
                // 弹窗类元素挂载到主应用 body
                if (element.classList.contains('modal') || 
                    element.classList.contains('dialog')) {
                  return document.body.appendChild(element)
                }
                
                // 普通元素挂载到 ShadowRoot
                return target.appendChild(element)
              }
            }
            
            return target[prop]
          }
        })
      }
    })
  }
}
```

### 3.3 Proxy 代理的核心 API

| 子应用调用 | Proxy 代理后的行为 | 效果 |
|-----------|------------------|------|
| `document.getElementById('app')` | 在 ShadowRoot 内查询 | 子应用获取到 ShadowRoot 内的挂载点 |
| `document.querySelector('.button')` | 在 ShadowRoot 内查询 | 子应用获取到 ShadowRoot 内的按钮 |
| `document.querySelector('body')` | 返回 WebComponent 本身 | 子应用认为自己在操作 body，实际在操作 WebComponent |
| `document.createElement('div')` | 在 iframe document 创建，标记 ShadowRoot | 元素后续会挂载到 ShadowRoot |
| `document.body.appendChild(element)` | 弹窗挂载到主应用 body，普通元素挂载到 ShadowRoot | Element Plus Modal 覆盖整个页面 |
| `element.appendChild(child)` | 挂载到 ShadowRoot | 子应用的 DOM 树渲染在 ShadowRoot 内 |

### 3.4 事件代理

```typescript
// Wujie 的事件代理（简化版）
class EventProxy {
  private iframe: HTMLIFrameElement
  private shadowRoot: ShadowRoot
  
  constructor(iframe: HTMLIFrameElement, shadowRoot: ShadowRoot) {
    this.iframe = iframe
    this.shadowRoot = shadowRoot
    
    this.setupEventProxy()
  }
  
  private setupEventProxy() {
    const iframeWindow = this.iframe.contentWindow!
    
    // 监听 ShadowRoot 内的事件
    this.shadowRoot.addEventListener('click', (event) => {
      // 事件冒泡到 ShadowRoot 后，转发到 iframe 的 window
      const newEvent = new event.constructor(event.type, event)
      iframeWindow.dispatchEvent(newEvent)
    })
    
    // 监听 iframe 内的事件
    iframeWindow.addEventListener('click', (event) => {
      // 事件冒泡到 iframe window 后，转发到 ShadowRoot
      const newEvent = new event.constructor(event.type, event)
      this.shadowRoot.dispatchEvent(newEvent)
    })
  }
}
```

**事件穿透的效果：**

```javascript
// 子应用内点击按钮（ShadowRoot 内）
button.addEventListener('click', () => {
  console.log('子应用按钮被点击')
})

// 主应用也能监听到（事件穿透）
document.querySelector('wujie-app').addEventListener('click', () => {
  console.log('主应用监听到子应用的点击事件')  // ✅
})
```

---

## 四、完整流程示例

### 4.1 子应用渲染流程

```javascript
// 子应用的代码（运行在 iframe 的 JS 沙箱中）

// 1. 获取挂载点（Proxy 代理后，实际查询 ShadowRoot）
const app = document.getElementById('app')
// → 返回 ShadowRoot 内的 <div id="app">

// 2. 创建元素（Proxy 代理后，标记 ShadowRoot）
const title = document.createElement('h1')
// → 在 iframe document 创建，标记 __wujie_shadow_root__

// 3. 设置内容
title.textContent = 'Hello Wujie'

// 4. 挂载到 DOM（Proxy 代理后，实际挂载到 ShadowRoot）
app.appendChild(title)
// → title 挂载到 ShadowRoot 内的 <div id="app">
// → 父页面可见 ✅

// 5. 使用第三方库（如 Element Plus）
ElMessage.success('操作成功')
// → Element Plus 内部调用 document.body.appendChild(messageElement)
// → Proxy 代理后，挂载到主应用 body
// → 弹窗覆盖整个页面 ✅
```

### 4.2 主应用操作流程

```javascript
// 主应用的代码

// 1. 获取 WebComponent
const wujieApp = document.querySelector('wujie-app')

// 2. 获取 ShadowRoot
const shadowRoot = wujieApp.shadowRoot

// 3. 获取子应用的 DOM（在 ShadowRoot 内）
const button = shadowRoot.querySelector('.my-button')
// → 可以操作子应用的 DOM ✅

// 4. 监听子应用的事件（事件穿透）
wujieApp.addEventListener('click', (event) => {
  console.log('子应用被点击', event.target)
  // → 可以监听子应用的点击事件 ✅
})

// 5. 修改子应用的样式（样式隔离，不影响子应用内部）
wujieApp.style.border = '1px solid red'
// → 只影响 WebComponent 本身，不影响 ShadowRoot 内的元素 ✅
```

---

## 五、面试话术

### Q1: 什么是 WebComponent？Wujie 为什么用它？

> "WebComponent 是浏览器原生的组件化方案，由 Custom Elements、Shadow DOM、HTML Templates 三部分组成。Wujie 用它的 Shadow DOM 特性：1) DOM 隔离：Shadow DOM 内的元素对外部不可见；2) 样式隔离：外部 CSS 不影响 Shadow DOM 内的样式；3) 事件穿透：Shadow DOM 内的事件可以冒泡到外部。Wujie 把子应用的 DOM 渲染到 Shadow DOM，实现了样式隔离，同时通过事件穿透让主应用和子应用可以互相通信。"

### Q2: Wujie 如何实现 JS 在 iframe 中执行、DOM 在父页面中渲染？

> "Wujie 通过 Proxy 代理子应用的 DOM API，把对 iframe document 的操作映射到 ShadowRoot。具体来说：1) 代理 `document.getElementById`/`querySelector`，在 ShadowRoot 内查询元素；2) 代理 `document.createElement`，标记元素后续会挂载到 ShadowRoot；3) 代理 `document.body.appendChild`，弹窗挂载到主应用 body，普通元素挂载到 ShadowRoot。这样子应用认为自己在操作正常的 document，实际上 DOM 渲染在父页面的 ShadowRoot 中。"

### Q3: Proxy 代理有什么坑？

> "三个坑：1) 性能开销：每次 DOM 操作都要经过 Proxy 拦截，大量 DOM 操作时性能会下降，Wujie 通过缓存和批量处理优化；2) 边界情况：有些 DOM API 不容易代理（如 `document.activeElement`、`document.scrollingElement`），需要特殊处理；3) 第三方库兼容性：有些库直接操作 `window.document` 而不是 `document`，需要额外代理。Wujie 的解决方案是在 iframe 的 window 上也挂载代理后的 document。"

---

## 六、总结

| 技术 | 作用 | Wujie 中的应用 |
|------|------|---------------|
| **WebComponent** | 提供 Shadow DOM，实现 DOM 和样式隔离 | 承载子应用的 DOM 渲染，隔离子应用和主应用的样式 |
| **iframe** | 提供 JS 沙箱，隔离 window/document/history | 运行子应用的 JS，隔离全局变量和事件 |
| **Proxy 代理** | 把 iframe 中的 DOM 操作映射到 ShadowRoot | 实现 JS 在 iframe 中执行、DOM 在父页面中渲染 |
| **事件穿透** | Shadow DOM 内的事件可以冒泡到外部 | 主应用和子应用互相监听事件 |

**核心思想：** JS 在 iframe 中执行（沙箱隔离）、DOM 在 ShadowRoot 中渲染（样式隔离）、Proxy 代理连接两者（无缝集成）。
