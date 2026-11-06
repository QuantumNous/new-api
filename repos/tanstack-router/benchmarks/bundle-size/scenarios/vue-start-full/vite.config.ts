import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { tanstackStart } from '@tanstack/vue-start/plugin/vite'

export default defineConfig({
  plugins: [tanstackStart(), vue(), vueJsx()],
})
