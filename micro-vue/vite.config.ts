import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    // wujie 从 host（localhost:5180）跨端口拉取子应用资源，需要放开 CORS
    cors: true,
    origin: 'http://localhost:5174',
  },
})
