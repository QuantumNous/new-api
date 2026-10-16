import { defineConfig } from 'vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import vueJsx from '@vitejs/plugin-vue-jsx'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), vueJsx(), sentryVitePlugin()],
})
