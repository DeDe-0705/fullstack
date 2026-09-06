import { defineConfig } from 'vitest/config'

// 独立的 vitest 配置：单元测试只看 tests/ 目录，
// 避免误扫 playwright-bdd 生成的 .features-gen/**/*.spec.js（那是 Playwright 的测试，不是 vitest 的）
export default defineConfig({
  test: {
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  },
})
