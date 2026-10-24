import { tanstackRouter } from '@tanstack/router-plugin/esbuild'

export default {
  // ...
  plugins: [
    tanstackRouter({
      autoCodeSplitting: true,
    }),
  ],
}
