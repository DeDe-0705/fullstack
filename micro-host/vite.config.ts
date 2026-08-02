import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // 本地直接引用 auth 包源码，免去 link；与子应用从 npm 引入的包名一致
      '@king-dede/auth': fileURLToPath(new URL('./packages/auth/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5180,
  },
})
