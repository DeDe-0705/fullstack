// 子应用地址集中在环境变量里注入：本地端口、测试环境、CDN 可以共用一套注册表
export const subAppUrls = {
  uiKit: import.meta.env.VITE_SUB_UI_KIT_URL ?? 'http://localhost:5173/',
  markdown: import.meta.env.VITE_SUB_MARKDOWN_URL ?? 'http://localhost:5175/',
  hr: import.meta.env.VITE_SUB_HR_URL ?? '',
  org: import.meta.env.VITE_SUB_ORG_URL ?? '',
  culture: import.meta.env.VITE_SUB_CULTURE_URL ?? '',
} as const
