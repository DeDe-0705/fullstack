// 模拟 LLM 流式输出的完整 markdown 文本
export const fullMarkdown = `# 微前端 Markdown 子应用

这是 **micro-vue** 子应用，基于 Vue 3 + [markstream-vue](https://markstream.simonhe.me/frameworks/vue) 渲染流式 Markdown，模拟 AI 对话中逐 token 输出的场景。

## 为什么用 markstream-vue

- 流式渲染：LLM 输出不完整 Markdown 时**不闪断、不错位**
- 渐进式 Mermaid / KaTeX / 代码块
- 长文档虚拟化，1MB+ 内容也能流畅渲染
- 安全 HTML 策略，无需 \`v-html\`

## 代码块

\`\`\`ts
import MarkdownRender from 'markstream-vue'
import 'markstream-vue/index.css'

// content 随流式输出持续增长即可
<MarkdownRender :content="content" :final="done" />
\`\`\`

## 表格

| 能力 | 支持 |
| --- | --- |
| 流式 Markdown | ✅ |
| Mermaid 渐进渲染 | ✅ |
| KaTeX 公式 | ✅ |
| 长文档虚拟化 | ✅ |

## 列表

1. 父应用统一鉴权（@king-dede/auth）
2. 子应用独立开发、独立部署
3. wujie 沙箱隔离，登录态经 localStorage 共享

> 流式输出中……这段文字是模拟逐字到达的效果。
`
