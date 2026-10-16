import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/vue-start/plugin/vite'
import vueJsx from '@vitejs/plugin-vue-jsx'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    port: 3000,
  },
  plugins: [tanstackStart(), vueJsx()],
})
