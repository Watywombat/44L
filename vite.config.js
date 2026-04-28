import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// ⚠️  Remplace 'NOM-DU-REPO' par le nom exact de ton dépôt GitHub
//     ex: base: '/jack-sparroue/',
export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE_URL || '/44L/',
  plugins: [
    vue(),
    // DevTools uniquement en local — jamais dans le build de prod
    command === 'serve'
      ? import('vite-plugin-vue-devtools').then(m => m.default())
      : null,
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}))
