import { defineConfig } from 'vitest/config'
import solid from 'vite-plugin-solid'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import packageJson from './package.json'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  test: {
    name: packageJson.name,
    dir: './tests',
    watch: false,
    environment: 'jsdom',
    typecheck: { enabled: true },
    server: {
      deps: {
        inline: [/@solidjs/, /@tanstack\/solid-store/],
      },
    },
  },
  plugins: [
    tailwindcss(),
    tanstackRouter({
      target: 'solid',
      autoCodeSplitting: true,
    }),
    solid(),
  ],
})
