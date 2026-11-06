import { tanstackRouter } from '@tanstack/router-plugin/esbuild'
import vuePlugin from 'esbuild-plugin-vue3'

export default {
  // ...
  plugins: [
    vuePlugin({
      cssInline: true,
    }),
    tanstackRouter({
      target: 'vue',
      autoCodeSplitting: true,
    }),
  ],
}
