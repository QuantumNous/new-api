import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: false,
    fileParallelism: false,
    projects: ['./scenarios/*/solid/vite.config.ts'],
  },
})
