import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: false,
    projects: ['./react/vite.config.ts', './scenarios/*/react/vite.config.ts'],
  },
})
