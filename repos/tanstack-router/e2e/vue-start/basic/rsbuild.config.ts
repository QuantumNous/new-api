import { defineConfig } from '@rsbuild/core'
import { pluginBabel } from '@rsbuild/plugin-babel'
import { pluginVue } from '@rsbuild/plugin-vue'
import { pluginVueJsx } from '@rsbuild/plugin-vue-jsx'
import { tanstackStart } from '@tanstack/vue-start/plugin/rsbuild'
import { isPrerender } from './tests/utils/isPrerender'

const outDir = process.env.E2E_DIST_DIR ?? 'dist'

export default defineConfig({
  plugins: [
    pluginBabel({
      include: /\.(?:jsx|tsx)$/,
    }),
    pluginVue(),
    pluginVueJsx(),
    tanstackStart(),
  ],
  performance: {
    chunkSplit: {
      strategy: 'split-by-experience',
    },
  },
  source: {
    define: {
      __TSR_PRERENDER__: JSON.stringify(isPrerender),
    },
  },
  output: {
    distPath: {
      root: outDir,
    },
  },
})
