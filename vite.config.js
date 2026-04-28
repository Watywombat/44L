import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ command }) => {
  const isDev = command === 'serve'

  return {
    base: '/44L/',
    plugins: [
      vue(),
      // DevTools seulement en local — exclu du build de production
      isDev && (() => {
        try {
          const { default: devtools } = require('vite-plugin-vue-devtools')
          return devtools()
        } catch { return null }
      })(),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
