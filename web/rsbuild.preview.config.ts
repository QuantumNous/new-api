import path from 'node:path'

import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss'

/** Static Pages build is isolated from the production gateway entry point and router. */
export default defineConfig({
  plugins: [pluginReact(), pluginTailwindcss()],
  source: { entry: { index: './src/preview/main.tsx' } },
  resolve: {
    alias: {
      '@/hooks/use-status': path.resolve('src/preview/status.ts'),
      '@/lib/orbit-brand': path.resolve('src/preview/brand.ts'),
      '@': path.resolve('src'),
    },
  },
  html: { template: './index.html', favicon: './public/orbit-mark.svg' },
  output: {
    assetPrefix: '/BEU-Developer-Orbit/',
    distPath: { root: 'dist-preview' },
    legalComments: 'linked',
  },
  performance: { buildCache: false },
})
