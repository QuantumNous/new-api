import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: false,
    projects: [
      './react/vite.config.ts',
      './solid/vite.config.ts',
      './vue/vite.config.ts',
    ],
  },
})
