import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: false,
    fileParallelism: false,
    projects: ['./scenarios/*/react/vite.config.ts'],
  },
})
