import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: false,
    projects: [
      './react/vite.config.ts',
      './solid/vite.config.ts',
      './vue/vite.config.ts',
      './scenarios/*/react/vite.config.ts',
      './scenarios/*/solid/vite.config.ts',
      './scenarios/*/vue/vite.config.ts',
    ],
  },
})
