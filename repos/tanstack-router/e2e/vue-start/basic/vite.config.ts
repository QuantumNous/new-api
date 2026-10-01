import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/vue-start/plugin/vite'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { isSpaMode } from './tests/utils/isSpaMode'
import { isPrerender } from './tests/utils/isPrerender'
import tailwindcss from '@tailwindcss/vite'

const spaModeConfiguration = {
  enabled: true,
  prerender: {
    outputPath: 'index.html',
  },
}

const prerenderConfiguration = {
  enabled: true,
  filter: (page: { path: string }) =>
    ![
      '/this-route-does-not-exist',
      '/redirect',
      '/i-do-not-exist',
      '/not-found',
      '/specialChars/search',
      '/specialChars/hash',
      '/specialChars/malformed',
      '/search-params', // search-param routes have dynamic content based on query params
      '/transition',
      '/users',
    ].some((p) => page.path.includes(p)),
  maxRedirects: 100,
}

const outDir = process.env.E2E_DIST_DIR ?? 'dist'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  build: {
    outDir,
  },
  server: {
    port: 3000,
  },
  define: {
    __TSR_PRERENDER__: JSON.stringify(isPrerender),
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      spa: isSpaMode ? spaModeConfiguration : undefined,
      prerender: isPrerender ? prerenderConfiguration : undefined,
    }),
    vueJsx(),
  ],
})
