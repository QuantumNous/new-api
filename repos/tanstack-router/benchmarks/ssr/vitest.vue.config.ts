import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: false,
    projects: ['./vue/vite.config.ts', './scenarios/*/vue/vite.config.ts'],
  },
})
