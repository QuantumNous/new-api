import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import codspeedPlugin from '@codspeed/vitest-plugin'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: rootDir,
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  plugins: [
    !!(process.env.VITEST && process.env.WITH_INSTRUMENTATION) &&
      codspeedPlugin(),
    tanstackRouter({
      target: 'react',
      routesDirectory: `${rootDir}src/routes`,
      generatedRouteTree: `${rootDir}src/routeTree.gen.ts`,
    }),
    react(),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: './src/main.tsx',
      formats: ['es'],
      fileName: 'app',
    },
  },
  test: {
    name: '@benchmarks/client-nav head (react)',
    watch: false,
    environment: 'jsdom',
    setupFiles: ['../../../vitest.setup.ts'],
  },
})
