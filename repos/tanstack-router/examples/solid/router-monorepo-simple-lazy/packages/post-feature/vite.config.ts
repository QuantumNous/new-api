import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import solid from 'vite-plugin-solid'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/post-feature',
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.json'),
    }),
    solid(),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: ['src/PostIdPage.tsx', 'src/PostList.tsx'],
      name: 'post-feature',
      formats: ['es'],
    },
    rolldownOptions: {
      // External packages that should not be bundled into your library.
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@tanstack/solid-router',
        '@router-solid-mono-simple-lazy/post-query',
        '@router-solid-mono-simple-lazy/router',
      ],
    },
  },
})
