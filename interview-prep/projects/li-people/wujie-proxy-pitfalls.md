# Wujie Proxy 代理的坑：第三方组件兼容问题

> Wujie 通过 Proxy 代理 document、window 等全局对象，但很多第三方组件直接操作真实 DOM，这些 API 返回的是浏览器真实 DOM 对象，不会经过 Proxy，导致组件对 DOM 树结构的假设被 Shadow DOM 打破。

---

## 一、问题场景

### 1.1 典型问题：vxe-table 虚拟滚动异常

```javascript
// vxe-table 内部实现（简化）
class VxeTable {
  private tbody: HTMLElement
  
  // 虚拟滚动：计算可见区域的行数
  computeVisibleRows() {
    // ❌ 问题1：offsetParent 返回真实 DOM 的 offsetParent
    const offsetParent = this.tbody.offsetParent
    // 期望：返回 ShadowRoot 内的容器
    // 实际：返回主应用的 body（因为 offsetParent 不经过 Proxy）
    
    // ❌ 问题2：getBoundingClientRect 返回真实 DOM 的位置
    const rect = this.tbody.getBoundingClientRect()
    // 期望：返回 ShadowRoot 内的位置
    // 实际：返回 iframe 的位置（不在可视区域内）
    
    // ❌ 问题3：ResizeObserver 监听真实 DOM
    new ResizeObserver(entries => {
      // 监听 ShadowRoot 内的元素，但回调中的 entry.target 是真实 DOM
      // 组件无法正确判断大小变化
    })
    
    // 结果：虚拟滚动计算错误，只渲染了几行，或者渲染位置不对
  }
}
```

### 1.2 典型问题：Element Plus 弹窗定位异常

```javascript
// Element Plus Select 下拉框定位（简化）
class ElSelect {
  private reference: HTMLElement  // 输入框
  private popper: HTMLElement     // 下拉框
  
  // 计算下拉框位置
  updatePopper() {
    // ❌ 问题：getBoundingClientRect 返回真实 DOM 的位置
    const rect = this.reference.getBoundingClientRect()
    // 期望：返回 ShadowRoot 内的位置
    // 实际：返回 iframe 的位置（不在可视区域内）
    
    // 结果：下拉框定位错误，显示在页面外或位置偏移
    this.popper.style.top = `${rect.bottom}px`
    this.popper.style.left = `${rect.left}px`
  }
}
```

### 1.3 典型问题：ECharts 事件绑定异常

```javascript
// ECharts 事件绑定（简化）
class ECharts {
  private dom: HTMLElement
  
  initEvents() {
    // ❌ 问题：event.target 是真实 DOM
    this.dom.addEventListener('click', (event) => {
      const target = event.target
      // 期望：target 是 ShadowRoot 内的 canvas 元素
      // 实际：target 是 iframe 内的元素（不可见）
      
      // 结果：无法正确判断点击的是哪个数据点
      const dataIndex = this.getDataIndex(target)
      // → 返回 null 或错误的索引
    })
  }
}
```

---

## 二、问题根源

### 2.1 Proxy 代理的边界

Wujie 的 Proxy 代理只能拦截**通过 document/window 对象调用的 API**，但很多第三方组件直接操作**真实 DOM 对象的属性和方法**，这些操作不经过 Proxy。

| API 类型 | 是否经过 Proxy | 示例 | 问题 |
|---------|--------------|------|------|
| **document 方法** | ✅ 经过 | `document.getElementById` | 可以代理到 ShadowRoot |
| **document 属性** | ✅ 经过 | `document.body` | 可以代理到 ShadowRoot |
| **DOM 元素属性** | ❌ 不经过 | `element.offsetParent` | 返回真实 DOM 的 offsetParent |
| **DOM 元素方法** | ❌ 不经过 | `element.getBoundingClientRect()` | 返回真实 DOM 的位置 |
| **DOM 事件** | ❌ 不经过 | `event.target` | 返回真实 DOM 的元素 |
| **浏览器 API** | ❌ 不经过 | `ResizeObserver` | 监听真实 DOM |

### 2.2 Shadow DOM 打破的假设

第三方组件对 DOM 树结构的假设：

```javascript
// 组件的假设（在普通页面中成立）
const element = document.getElementById('my-element')
element.offsetParent === document.body  // ✅ 成立

// 在 Wujie 的 Shadow DOM 中
const element = document.getElementById('my-element')  // Proxy 代理到 ShadowRoot
element.offsetParent === document.body  // ❌ 不成立
// 实际：element.offsetParent 是 ShadowRoot 内的某个元素，不是 body
```

---

## 三、常见坑及解决方案

### 3.1 offsetParent / parentNode

**问题：** 返回真实 DOM 的父元素，不是 ShadowRoot 内的父元素。

```javascript
// ❌ 问题代码
const element = document.getElementById('my-element')
console.log(element.offsetParent)  // 返回真实 DOM 的 offsetParent（可能是 body）
console.log(element.parentNode)    // 返回真实 DOM 的 parentNode（可能是 iframe 内的元素）
```

**解决方案：**

```javascript
// ✅ 方案1：通过 ShadowRoot 查询父元素
const element = document.getElementById('my-element')
const shadowRoot = element.getRootNode()  // 获取 ShadowRoot
const parent = shadowRoot.querySelector('.parent-class')

// ✅ 方案2：使用 composedPath() 获取事件路径
element.addEventListener('click', (event) => {
  const path = event.composedPath()  // 返回事件路径，包括 ShadowRoot 内的元素
  const parent = path.find(el => el.classList?.contains('parent-class'))
})
```

### 3.2 getBoundingClientRect

**问题：** 返回真实 DOM 的位置，不是 ShadowRoot 内的位置。

```javascript
// ❌ 问题代码
const element = document.getElementById('my-element')
const rect = element.getBoundingClientRect()
// rect.top/left 是相对于真实 DOM 的位置，不是 ShadowRoot 内的位置
```

**解决方案：**

```javascript
// ✅ 方案1：手动计算偏移量
const element = document.getElementById('my-element')
const rect = element.getBoundingClientRect()
const shadowRoot = element.getRootNode()
const host = shadowRoot.host  // WebComponent 本身
const hostRect = host.getBoundingClientRect()

// 计算相对于 ShadowRoot 的位置
const relativeRect = {
  top: rect.top - hostRect.top,
  left: rect.left - hostRect.left,
  width: rect.width,
  height: rect.height
}

// ✅ 方案2：使用 Wujie 提供的工具函数
import { getElementRect } from 'wujie'

const rect = getElementRect(element)  // 自动处理 ShadowRoot 偏移
```

### 3.3 ResizeObserver

**问题：** 监听真实 DOM，回调中的 entry.target 不是 ShadowRoot 内的元素。

```javascript
// ❌ 问题代码
const element = document.getElementById('my-element')
new ResizeObserver(entries => {
  const target = entries[0].target
  // target 是真实 DOM 的元素，不是 ShadowRoot 内的元素
  console.log(target.id)  // undefined 或错误的 id
})
```

**解决方案：**

```javascript
// ✅ 方案1：通过 getRootNode() 判断是否在 ShadowRoot 内
const element = document.getElementById('my-element')
new ResizeObserver(entries => {
  const target = entries[0].target
  const shadowRoot = target.getRootNode()
  
  if (shadowRoot instanceof ShadowRoot) {
    // 在 ShadowRoot 内，正确处理
    const realElement = shadowRoot.querySelector(`#${target.id}`)
    console.log(realElement)
  }
})

// ✅ 方案2：使用 MutationObserver 替代（监听 ShadowRoot 内的变化）
const shadowRoot = document.querySelector('wujie-app').shadowRoot
new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    console.log('DOM 变化', mutation.target)
  })
}).observe(shadowRoot, { childList: true, subtree: true })
```

### 3.4 event.target

**问题：** 事件回调中的 event.target 是真实 DOM 的元素，不是 ShadowRoot 内的元素。

```javascript
// ❌ 问题代码
document.addEventListener('click', (event) => {
  const target = event.target
  console.log(target.id)  // undefined 或错误的 id
})
```

**解决方案：**

```javascript
// ✅ 方案1：使用 event.composedPath()
document.addEventListener('click', (event) => {
  const path = event.composedPath()  // 返回事件路径，包括 ShadowRoot 内的元素
  const target = path[0]  // 实际被点击的元素
  console.log(target.id)  // ✅ 正确的 id
})

// ✅ 方案2：使用 event.target.getRootNode()
document.addEventListener('click', (event) => {
  const target = event.target
  const shadowRoot = target.getRootNode()
  
  if (shadowRoot instanceof ShadowRoot) {
    // 在 ShadowRoot 内，通过 composedPath 获取真实元素
    const path = event.composedPath()
    const realTarget = path[0]
    console.log(realTarget.id)
  }
})
```

---

## 四、vxe-table 兼容方案

### 4.1 问题诊断

```javascript
// vxe-table 虚拟滚动异常的原因
class VxeTable {
  computeVisibleRows() {
    // 1. offsetParent 返回真实 DOM 的 offsetParent
    const offsetParent = this.tbody.offsetParent
    // → 返回 body，不是 ShadowRoot 内的容器
    
    // 2. getBoundingClientRect 返回真实 DOM 的位置
    const rect = this.tbody.getBoundingClientRect()
    // → 返回 iframe 的位置，不是 ShadowRoot 内的位置
    
    // 3. 计算可见行数时，使用了错误的容器和位置
    const visibleCount = Math.ceil(rect.height / rowHeight)
    // → 计算结果错误，可能为 0 或负数
  }
}
```

### 4.2 解决方案

```javascript
// ✅ 方案1：修改 vxe-table 源码，使用 composedPath 和 getRootNode
class VxeTable {
  computeVisibleRows() {
    // 使用 composedPath 获取 ShadowRoot 内的容器
    const path = this.tbody.composedPath()
    const container = path.find(el => el.classList?.contains('vxe-table-container'))
    
    // 使用 getRootNode() 获取 ShadowRoot
    const shadowRoot = this.tbody.getRootNode()
    const host = shadowRoot.host
    const hostRect = host.getBoundingClientRect()
    
    // 计算相对于 ShadowRoot 的位置
    const rect = this.tbody.getBoundingClientRect()
    const relativeRect = {
      top: rect.top - hostRect.top,
      height: rect.height
    }
    
    // 正确计算可见行数
    const visibleCount = Math.ceil(relativeRect.height / rowHeight)
  }
}

// ✅ 方案2：使用 Wujie 的 jsBeforeLoaders 注入修复代码
WujieVue.setupApp({
  name: 'hr-module',
  jsBeforeLoaders: [
    {
      callback: (iframeWindow) => {
        // 修复 vxe-table 的兼容问题
        const originalComputeVisibleRows = iframeWindow.VxeTable.prototype.computeVisibleRows
        iframeWindow.VxeTable.prototype.computeVisibleRows = function() {
          // 使用修复后的逻辑
          const path = this.tbody.composedPath()
          // ...
        }
      }
    }
  ]
})
```

---

## 五、通用解决方案

### 5.1 Wujie 提供的工具函数

```typescript
// Wujie 提供的工具函数
import { 
  getElementRect,      // 获取元素在 ShadowRoot 内的位置
  getEventTarget,      // 获取事件的真实目标
  getElementParent,    // 获取元素在 ShadowRoot 内的父元素
  patchThirdPartyLib   // 修复第三方库兼容问题
} from 'wujie'

// 使用示例
const rect = getElementRect(element)  // 自动处理 ShadowRoot 偏移
const target = getEventTarget(event)  // 自动使用 composedPath
const parent = getElementParent(element)  // 自动使用 getRootNode
```

### 5.2 手动修复第三方库

```typescript
// 手动修复第三方库的兼容问题
function patchThirdPartyLib(iframeWindow: Window) {
  // 修复 getBoundingClientRect
  const originalGetBoundingClientRect = iframeWindow.Element.prototype.getBoundingClientRect
  iframeWindow.Element.prototype.getBoundingClientRect = function() {
    const rect = originalGetBoundingClientRect.call(this)
    const shadowRoot = this.getRootNode()
    
    if (shadowRoot instanceof ShadowRoot) {
      const host = shadowRoot.host
      const hostRect = host.getBoundingClientRect()
      
      return {
        top: rect.top - hostRect.top,
        left: rect.left - hostRect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom - hostRect.top,
        right: rect.right - hostRect.left
      }
    }
    
    return rect
  }
  
  // 修复 event.target
  const originalAddEventListener = iframeWindow.EventTarget.prototype.addEventListener
  iframeWindow.EventTarget.prototype.addEventListener = function(type, listener, options) {
    const wrappedListener = (event) => {
      // 使用 composedPath 获取真实 target
      const path = event.composedPath()
      const realTarget = path[0]
      
      // 创建新的事件对象，替换 target
      const newEvent = new Proxy(event, {
        get: (target, prop) => {
          if (prop === 'target') {
            return realTarget
          }
          return target[prop]
        }
      })
      
      listener.call(this, newEvent)
    }
    
    originalAddEventListener.call(this, type, wrappedListener, options)
  }
}

// 在 Wujie 的 jsBeforeLoaders 中使用
WujieVue.setupApp({
  name: 'hr-module',
  jsBeforeLoaders: [
    {
      callback: (iframeWindow) => {
        patchThirdPartyLib(iframeWindow)
      }
    }
  ]
})
```

---

## 六、面试话术

### Q1: Wujie 的 Proxy 代理有什么坑？

> "Wujie 的 Proxy 代理只能拦截通过 document/window 对象调用的 API，但很多第三方组件直接操作真实 DOM 的属性和方法，如 offsetParent、getBoundingClientRect、ResizeObserver、event.target 等，这些 API 返回的是浏览器真实 DOM 对象，不会经过 Proxy。我们接入 Wujie 后，vxe-table 的虚拟滚动、Element Plus 的弹窗定位、ECharts 的事件绑定都遇到过兼容问题。"

### Q2: 如何解决第三方组件的兼容问题？

> "三个方案：1) 使用 Wujie 提供的工具函数（getElementRect、getEventTarget 等），自动处理 ShadowRoot 偏移和事件穿透；2) 手动修复第三方库，通过 jsBeforeLoaders 注入修复代码，重写 getBoundingClientRect、addEventListener 等方法；3) 修改第三方库源码，使用 composedPath() 和 getRootNode() 获取 ShadowRoot 内的元素。我们实际项目中用方案2，通过 jsBeforeLoaders 统一修复 vxe-table、Element Plus 等库的兼容问题。"

### Q3: 如何避免引入新的兼容问题？

> "三个措施：1) 技术选型时优先选择对 Shadow DOM 友好的库（如 Element Plus 2.x、Ant Design Vue 3.x）；2) 接入新库前先在 Wujie 环境中测试，重点测试虚拟滚动、弹窗定位、事件绑定等场景；3) 建立兼容性测试用例库，每次升级 Wujie 或第三方库时跑一遍，确保没有引入新问题。"

---

## 七、总结

| 问题类型 | 原因 | 解决方案 |
|---------|------|---------|
| offsetParent / parentNode | 返回真实 DOM 的父元素 | 使用 getRootNode() 或 composedPath() |
| getBoundingClientRect | 返回真实 DOM 的位置 | 手动计算 ShadowRoot 偏移，或使用 Wujie 工具函数 |
| ResizeObserver | 监听真实 DOM | 使用 MutationObserver 替代，或通过 getRootNode() 判断 |
| event.target | 返回真实 DOM 的元素 | 使用 composedPath() 获取真实 target |
| 第三方库兼容 | 直接操作真实 DOM | 通过 jsBeforeLoaders 注入修复代码 |

**核心思想：** Proxy 代理只能拦截 document/window 的 API，第三方组件直接操作真实 DOM 时会绕过 Proxy，需要通过 composedPath()、getRootNode() 等 API 手动处理 ShadowRoot 的边界情况。
