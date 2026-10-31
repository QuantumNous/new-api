import { defineConfig } from '@rsbuild/core'
import { pluginVue } from '@rsbuild/plugin-vue'
import { pluginVueJsx } from '@rsbuild/plugin-vue-jsx'
import { tanstackRouter } from '@tanstack/router-plugin/rspack'
import { pluginBabel } from '@rsbuild/plugin-babel'

export default defineConfig({
  plugins: [
    pluginBabel({
      include: /\.(?:jsx|tsx)$/,
    }),
    pluginVue(),
    pluginVueJsx(),
  ],
  source: {
    define: {
      // Rsbuild only defines `import.meta.env.PUBLIC_*` when the env var exists.
      // When it doesn't, rspack can transform `import.meta.env` to `void 0`, which
      // makes `import.meta.env.PUBLIC_*` crash at runtime.
      'import.meta.env.PUBLIC_NODE_ENV': JSON.stringify(
        process.env.PUBLIC_NODE_ENV ?? '',
      ),
      'import.meta.env.PUBLIC_EXTERNAL_PORT': JSON.stringify(
        process.env.PUBLIC_EXTERNAL_PORT ?? '',
      ),
    },
  },
  tools: {
    rspack: {
      plugins: [
        tanstackRouter({
          target: 'vue',
          autoCodeSplitting: true,
          virtualRouteConfig: './routes.ts',
        }),
      ],
    },
  },
})
