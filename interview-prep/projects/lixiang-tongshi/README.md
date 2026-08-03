# 理想同事 — 面试要点

> 项目时间：2025.04 - 2025.05 | 角色：项目 Owner
> 技术栈：Vue3 + TypeScript + SSE 流式渲染 + Iframe 通信 + CDN 动态组件

---

## 一、项目一句话介绍

> "理想同事是理想汽车内部的 AI Agent 问答平台，集成行政、财经、IT、人力多领域问答能力，支持员工通过对话完成请假、销假等考勤操作。我负责前端架构设计，核心解决了流式渲染、跨应用嵌入通信、动态组件按需加载三大技术难题。"

---

## 二、项目背景与定位

```
定位：
  - 面向全员：快速获取多领域专业问答（行政/财经/IT/人力）
  - 面向运营：产品分析与场景优化
  - 核心场景：对话式完成业务办理（如提交请假、销假表单）

技术挑战：
  1. AI 响应是流式的，前端需要实时渲染 Markdown
  2. 业务表单需要动态加载，不能打包进主应用
  3. 需要嵌入到其他业务系统（Iframe），同步上下文给 AI
```

---

## 三、核心架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────┐
│           理想同事 H5 主应用              │
│  ┌──────────┐ ┌──────────┐              │
│  │ 对话界面   │ │ 流式渲染   │              │
│  ├──────────┤ ├──────────┤              │
│  │ 会话管理   │ │ 组件加载   │              │
│  ├──────────┤ ├──────────┤              │
│  │ Iframe   │ │ 异常兜底   │              │
│  │ 通信模块   │ │ 重试机制   │              │
│  └──────────┘ └──────────┘              │
├─────────────────────────────────────────┤
│         CDN 动态组件库                    │
│  ┌──────┐ ┌──────┐ ┌──────┐            │
│  │请假表单│ │销假表单│ │报销表单│  ...      │
│  │v1.0.0│ │v1.2.0│ │v0.9.0│            │
│  └──────┘ └──────┘ └──────┘            │
├─────────────────────────────────────────┤
│         AI 服务端 (SSE 流式响应)          │
└─────────────────────────────────────────┘
```

### 3.2 流式渲染架构

**问题：** AI 响应是逐字生成的（SSE 流式推送），前端需要实时把内容渲染出来。难点在于：流式碎片里 **Markdown 语法经常是半截的**（比如 `**加粗`、代码块只到了一半），普通渲染器会闪烁或显示原始符号；且 AI 不只是返回文本，还会**指示前端渲染特定业务组件**（请假表单卡片、个人信息卡片等）。

**方案：** SSE 接收流式内容，文本部分交给 **markstream-vue** 渲染——专为 AI 流式场景设计的渲染库；组件部分由 AI 在返回的 JSON 中下发指令（组件名 + props），走 3.3 的 CDN 链路加载渲染。

**选型 markstream-vue 的四个理由：**

1. **流式碎片解析极强**：AI 一边输出一边渲染，半截 Markdown 语法也不会闪烁或裸露原始符号——普通渲染器遇到未闭合语法会布局跳动，markstream-vue 针对流式增量做了专门处理
2. **支持自定义标签渲染**：可以把标签映射成自定义 Vue 组件——`thinking` 渲染成可折叠的思考卡片（流式中间态也有对应展示），代码块覆盖默认渲染做 highlight.js 高亮 + 复制按钮
3. **作用域隔离**：多对话窗口、多子应用嵌套的场景下渲染互不干扰
4. **体积轻、无重型依赖**：内网打包友好，不引入大型解析器

**自定义标签处理（code / thinking）：**

markstream-vue 支持把标签映射成自定义 Vue 组件。我们做了两处：`thinking` 标签渲染成可折叠的思考过程卡片（流式传输中间态会展开显示"思考中..."，结束后折叠，不干扰正式回答阅读）；代码块用自定义组件覆盖默认渲染，做 highlight.js 高亮 + 一键复制按钮。

```typescript
// composables/useStreamChat.ts：SSE 接收流式内容，按类型分发
export function useStreamChat() {
  const messages = ref<StreamMessage[]>([])

  function connectSSE(url: string, messageId: string) {
    const eventSource = new EventSource(url)

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      const msg = messages.value.find(m => m.id === messageId)

      if (data.type === 'content') {
        // 文本内容：流式追加，模板里交给 markstream-vue 渲染
        msg.content += data.text
      } else if (data.type === 'component') {
        // 组件指令：AI 告诉前端渲染特定组件，携带 props
        // { type: 'component', name: 'leave-form', url: 'https://cdn.../index.js', props: {...} }
        msg.component = { name: data.name, url: data.url, props: data.props }
      } else if (data.type === 'done') {
        eventSource.close()
        msg.status = 'done'
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
      const msg = messages.value.find(m => m.id === messageId)
      if (msg) msg.status = 'error'
    }
  }

  return { messages, connectSSE }
}
```

```vue
<!-- 消息气泡：文本用 markstream-vue 渲染，组件指令用全局组件渲染 -->
<template>
  <div class="chat-message">
    <!-- 文本内容：markstream-vue 流式渲染 -->
    <MarkdownRender :content="message.content" :custom-html-tags="['thinking']" />

    <!-- 组件指令：AI 在 JSON 中下发组件名 + props，组件来自 CDN 全局注册 -->
    <component
      v-if="message.component && scriptLoaded"
      :is="message.component.name"
      v-bind="message.component.props"
      @submit="onComponentSubmit"
    />
  </div>
</template>
```

**面试追问：SSE 和 WebSocket 怎么选？**

> "AI 对话场景选 SSE，原因：1) AI 生成是单向的（服务器→客户端），SSE 刚好匹配；2) SSE 基于 HTTP，不需要协议升级，穿透性好；3) 浏览器原生支持 EventSource，自动重连；4) WebSocket 双向通信在这种场景是浪费，还要处理心跳、连接管理。"

**面试追问：流式过程中 Markdown 语法未闭合（比如 `**` 只输出了一半）怎么办？**

> "这正是我们选 markstream-vue 的核心原因——它的流式碎片解析能力很强，AI 一边输出一边渲染，半截语法也不会闪烁或显示原始符号。普通 Markdown 渲染器（marked、markdown-it）遇到未闭合语法会出现布局跳动或裸露字符，自己做缓冲和降级处理成本很高，markstream-vue 在解析层就把这个问题解决了。"

**面试追问：AI 是怎么触发前端渲染业务组件的？**

> "AI 不直接返回 HTML 标签，而是在返回的 JSON 中告诉前端：当前会话要渲染哪个组件，同时携带对应的 props。前端收到组件指令后，通过 CDN script 加载组件包（组件在包里已全局注册），然后用 `<component :is>` 按组件名渲染——请假表单卡片、个人信息卡片、政策文档弹窗都是这条链路。AI 只需要输出结构化指令，不需要关心前端组件怎么实现，前后端契约就是组件名 + props 的 JSON 协议。"

### 3.3 动态组件 CDN 加载

**问题：** 业务表单（请假/销假/报销）**需求多变、迭代频繁**，如果打包进主应用，每次改表单都要主应用发版；且加载哪个组件是 **AI 在对话过程中动态决定的**，前端无法提前知道。

**方案：** 组件独立打包成 UMD 上传到 CDN，**独立发版、主应用零改动**——AI 返回组件的 CDN url，前端通过 script 标签加载；组件加载执行后内部完成 Vue 全局注册，渲染时直接用组件名即可。

```typescript
// utils/componentLoader.ts：script 加载 CDN 组件（含 url 缓存）
const loadedUrls = new Set<string>()

export function loadComponentScript(url: string): Promise<void> {
  if (loadedUrls.has(url)) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = url
    script.onload = () => { loadedUrls.add(url); resolve() }
    script.onerror = () => reject(new Error(`Failed to load ${url}`))
    document.head.appendChild(script)
  })
}
```

```vue
<!-- components/ChatMessage.vue：AI 返回 url，加载后用组件名渲染 -->
<component
  v-else-if="message.type === 'component' && scriptLoaded"
  :is="message.name"
  v-bind="message.props"
  @submit="onComponentSubmit"
/>

<script setup lang="ts">
watch(() => props.message, async (msg) => {
  if (msg.type === 'component') {
    await loadComponentScript(msg.url)   // script 加载执行后组件自动全局注册
    scriptLoaded.value = true
  }
}, { immediate: true })
</script>
```

**组件独立打包配置：**

```typescript
// packages/biz-forms/vite.config.ts
build: {
  lib: { entry: 'src/index.ts', name: 'BizForms', formats: ['umd'], fileName: 'index' },
  rollupOptions: {
    external: ['vue'],     // Vue 不打包，复用主应用的 Vue 实例
    output: { globals: { vue: 'Vue' } }
  }
}

// packages/biz-forms/src/index.ts：加载执行后批量注册所有表单组件
export default {
  install(app: App) {
    Object.entries({
      'leave-form': LeaveForm,
      'cancel-leave-form': CancelLeaveForm,
      'expense-form': ExpenseForm
    }).forEach(([name, comp]) => app.component(name, comp))
  }
}
```

**方案要点：**

1. **独立发版是核心动机**：表单需求多变，组件包独立迭代、独立发版，改表单不需要主应用发版——发布节奏解耦
2. **AI 驱动加载**：加载哪个组件由 AI 返回的 url 决定，新增表单类型只需要组件包发版 + AI 侧配置 url，主应用零改动
3. **script 加载 + 批量全局注册**：一个脚本包含多个表单组件，加载执行后 `app.component()` 批量注册，渲染时 `<component :is="'leave-form'">` 直接用组件名
4. **Vue 走 external**：组件不打包 Vue，复用主应用的 Vue 实例——这也是全局注册能生效的前提（注册的必须是同一个 app）

**面试追问：组件版本怎么管理？**

> "版本号直接体现在 CDN url 路径里（如 `/biz-forms/1.2.0/index.js`），AI 返回哪个版本的 url 就加载哪个版本。历史消息中的组件按当时的 url 渲染，保证可回溯；新版本发布后，新对话用新版本，老对话还是老版本。"

**面试追问：为什么组件包用 UMD 格式，而不是 ESM？**

> "由加载方式决定：我们是 script 标签直接加载 CDN 文件，运行时没有打包器参与。ESM 的 `import vue from 'vue'` 这种裸标识符浏览器无法解析（除非 type=module + importmap，方案较新、内网老环境有风险）；而 UMD 加载即执行，通过 `globals: { vue: 'Vue' }` 从全局变量拿到主应用的 Vue 实例，然后批量 `app.component()` 注册——自闭合、兼容性最好。这也是 external Vue 能成立的前提。"

### 3.4 Iframe 跨应用通信

**问题：** 理想同事以 Iframe 嵌入到业务系统（如考勤系统）中，用户在宿主系统里填写表单（如请假申请）时，AI 需要"看到"用户填了什么、哪里报错了，才能给出针对性的分析和建议；AI 分析完后，还需要把结果**回填到宿主系统的表单里**。Iframe 隔离了双方的 JS 环境，怎么打通？

**方案：** postMessage 双向通信——宿主系统把**整个表单对象和校验报错信息**传给 AI，AI 分析后把**回填数据**传回宿主系统

```
双向通信流程：

  宿主系统（如考勤系统）                理想同事（Iframe）
  ┌──────────────────────┐            ┌──────────────────────┐
  │  用户填写请假表单       │            │                      │
  │  · 请假类型：年假       │            │                      │
  │  · 开始时间：08-05     │  ① 表单对象 │                      │
  │  · 结束时间：08-03     │ ─────────→ │  AI 收到完整表单数据    │
  │  · 报错：结束时间早于    │  + 报错信息 │  作为上下文一起发给模型 │
  │    开始时间            │            │                      │
  │                      │            │  ② AI 分析：            │
  │                      │            │  "结束时间 08-03 早于   │
  │                      │            │   开始时间 08-05，请    │
  │                      │            │   检查；建议修正为      │
  │                      │            │   08-05 ~ 08-07"       │
  │                      │  ③ 回填数据  │                      │
  │  表单自动回填修正值     │ ←───────── │  { endDate: '08-07' } │
  │  用户确认后提交        │            │                      │
  └──────────────────────┘            └──────────────────────┘
```

```typescript
// 宿主系统：监听表单变化，把表单对象和报错信息传给 AI
// host-system/src/views/LeaveForm.vue
const iframeRef = ref<HTMLIFrameElement>()

// 表单数据或校验报错变化时，同步给理想同事
watch([formData, formErrors], () => {
  iframeRef.value?.contentWindow?.postMessage(
    {
      type: 'FORM_CONTEXT',
      payload: {
        formType: 'leave',           // 表单类型：请假
        formData: { ...formData },   // 整个表单对象（请假类型、起止时间、时长...）
        errors: { ...formErrors }    // 校验报错（如"结束时间早于开始时间"）
      }
    },
    'https://tongshi.lixiang.com'    // 指定目标源
  )
}, { deep: true })

// 接收 AI 的回填指令，自动回填表单
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://tongshi.lixiang.com') return  // 源校验

  const { type, payload } = event.data
  if (type === 'FORM_FILL') {
    // AI 分析后给出的回填数据，合并进表单
    Object.assign(formData, payload)
  }
})
```

```typescript
// 理想同事：接收表单上下文，作为 AI 对话的输入；AI 分析后下发回填指令
// lixiang-tongshi/src/composables/useIframeContext.ts
window.addEventListener('message', (event) => {
  if (!isTrustedOrigin(event.origin)) return  // 白名单校验

  const { type, payload } = event.data
  if (type === 'FORM_CONTEXT') {
    // 把表单对象和报错信息作为上下文，随用户消息一起发给模型
    // 这样用户问"帮我看看这个请假单填得对不对"时，AI 能拿到完整现场
    chatStore.setContext({
      formType: payload.formType,
      formData: payload.formData,
      errors: payload.errors
    })
  }
})

// AI 分析完返回结构化回填指令时，转发给宿主系统
// 例如 AI 输出 { action: 'fill', fields: { endDate: '2026-08-07' } }
function onAIFillCommand(fields: Record<string, any>) {
  window.parent.postMessage(
    { type: 'FORM_FILL', payload: fields },
    hostOrigin  // 已知的宿主源
  )
}
```

**方案要点：**

1. **传整个表单对象，不是单个字段**：AI 需要完整上下文才能分析——比如"结束时间早于开始时间"这种错误，必须同时拿到两个字段才能判断
2. **报错信息同步传递**：表单校验的报错（哪个字段、什么错误）一并传给 AI，AI 可以直接针对报错给出修正建议，而不只是泛泛而谈
3. **回填是双向的关键闭环**：AI 分析结果结构化为字段键值对，宿主系统收到后 `Object.assign` 合并进表单，用户确认后提交——AI 不只是"说"，还能直接"改"
4. **安全校验**：发送方指定目标源，接收方校验 `event.origin` 白名单，只处理预定义的消息 type

**面试追问：postMessage 安全怎么保证？**

> "三层校验：1) 发送时指定目标源（不用 `*`）；2) 接收时验证 `event.origin` 是否在白名单；3) 消息格式校验，只处理预定义的 type（FORM_CONTEXT / FORM_FILL 等）。敏感数据（如 token）不通过 postMessage 传输，表单数据本身也是业务数据而非凭证。"

**面试追问：为什么把表单报错信息也传给 AI？**

> "因为报错信息是 AI 分析的关键线索。比如用户填了请假单，前端校验出'结束时间早于开始时间'，如果只传表单数据，AI 要自己重新做一遍校验逻辑才能发现问题；把报错信息一起传过去，AI 可以直接针对报错给出解释和修正建议——'你的结束时间 08-03 早于开始时间 08-05，建议修正为 08-07'，然后下发回填指令。这样 AI 的回答更精准，也避免了前后端校验逻辑重复维护。"

---

## 四、工程化封装

### 4.1 统一流式响应处理

```typescript
// utils/streamHandler.ts
export class StreamHandler {
  private eventSource: EventSource | null = null
  private reconnectCount = 0
  private maxReconnect = 3
  
  connect(
    url: string,
    callbacks: {
      onMessage: (data: any) => void
      onError: (error: Error) => void
      onComplete: () => void
    }
  ) {
    this.eventSource = new EventSource(url)
    
    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        callbacks.onMessage(data)
        
        if (data.type === 'done') {
          this.disconnect()
          callbacks.onComplete()
        }
      } catch (e) {
        callbacks.onError(new Error('Parse error'))
      }
    }
    
    this.eventSource.onerror = () => {
      if (this.reconnectCount < this.maxReconnect) {
        this.reconnectCount++
        setTimeout(() => this.connect(url, callbacks), 1000 * this.reconnectCount)
      } else {
        this.disconnect()
        callbacks.onError(new Error('Max reconnect reached'))
      }
    }
  }
  
  disconnect() {
    this.eventSource?.close()
    this.eventSource = null
    this.reconnectCount = 0
  }
  
  // 取消生成
  abort() {
    this.disconnect()
    // 同时通知后端取消
    fetch('/api/chat/abort', { method: 'POST' })
  }
}
```

---

## 五、高频面试题

### Q1: 为什么选 SSE 不用 WebSocket？

> "三个原因：1) AI 生成是单向的，SSE 刚好匹配，WebSocket 双向通信是浪费；2) SSE 基于 HTTP，不需要协议升级，防火墙穿透性好；3) 浏览器原生支持 EventSource，自动重连，开发简单。如果未来需要双向实时交互（如协同编辑），会考虑 WebSocket。"

### Q2: 流式渲染的性能怎么考虑？

> "目前没有做专门的性能优化——AI 对话场景的消息长度有限，markstream-vue 本身就是为流式增量渲染设计的，实测完全流畅。如果未来消息变长或频率变高，优化方向是：1) 长会话做消息虚拟列表；2) Web Worker 里跑解析不阻塞主线程。但现阶段没有动力为不存在的问题加复杂度。"

### Q3: 动态组件加载失败怎么办？

> "三级兜底：1) 加载失败时显示占位组件，提示'组件加载失败，请刷新重试'；2) 自动降级：如果动态组件加载失败，降级为纯文本表单；3) 错误上报：记录组件加载失败日志，监控告警。"

### Q4: Iframe 通信有什么限制？怎么解决？

> "主要限制：1) 跨域限制——通过 postMessage 解决，但要做好源校验；2) 样式隔离——Iframe 内部样式独立，需要通过 CSS 变量同步主题；3) 弹窗限制——Iframe 内的弹窗只覆盖 Iframe 区域，通过 postMessage 通知宿主系统显示全局弹窗。"

### Q5: 如果重新做一次，你会怎么改进？

> "三个方向：1) 引入 Web Worker 处理 Markdown 解析，避免阻塞主线程；2) 建设更完善的组件沙箱，支持 React/Vue 混用；3) 探索 SSR/SSG 方案，提升首屏加载速度。"

---

## 六、项目亮点总结

| 亮点 | 说明 | 面试价值 |
|------|------|----------|
| 流式渲染架构 | SSE + markstream-vue 流式碎片解析 + JSON 组件指令（组件名+props） | AI 项目核心能力，2026 年最热门 |
| 动态组件 CDN | AI 返回 CDN url → script 加载 → 全局注册 → 组件名渲染 | 体现工程化思维 |
| Iframe 跨应用通信 | postMessage 传整个表单对象+报错给 AI 分析，AI 结构化回填 | 体现系统设计能力 |
| 异常兜底 | 重试机制 + 降级方案 + 错误上报 | 体现稳定性意识 |
