import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tanstackStart({
      srcDirectory: './src/app',
      router: {
        entry: '../router.tsx',
        routesDirectory: '../routes',
        generatedRouteTree: '../routeTree.gen.ts',
      },
    }),
  ],
})
