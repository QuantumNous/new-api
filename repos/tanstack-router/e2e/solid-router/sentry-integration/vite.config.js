import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), solid(), sentryVitePlugin()],
})
