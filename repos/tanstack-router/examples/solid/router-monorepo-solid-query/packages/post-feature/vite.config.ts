import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import solid from 'vite-plugin-solid'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/router',
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
      entry: 'src/index.ts',
      name: 'router',
      fileName: 'index',
      formats: ['es'],
    },
    rolldownOptions: {
      // External packages that should not be bundled into your library.
      external: [
        'solid-js',
        'solid-js/web',
        '@tanstack/solid-query',
        '@tanstack/solid-router',
        '@router-solid-mono-solid-query/post-query',
        '@router-solid-mono-solid-query/router',
      ],
    },
  },
})
