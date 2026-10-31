import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: false,
    projects: ['./solid/vite.config.ts', './scenarios/*/solid/vite.config.ts'],
  },
})
