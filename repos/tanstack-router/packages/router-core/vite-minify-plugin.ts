import { transform as esbuildTransform } from 'esbuild'
import type { Plugin } from 'vite'

export default function minifyScriptPlugin(): Plugin {
  return {
    name: 'vite-plugin-minify-script',
    enforce: 'pre',
    transform: {
      filter: { id: /\?script-string$/ },
      async handler(code) {
        const result = await esbuildTransform(code, {
          loader: 'ts',
          minify: true,
          target: 'esnext',
        })

        // Source files may use `export default …`. esbuild preserves that,
        // but we need a bare expression so it can be embedded in inline
        // scripts (e.g. as an IIFE: `(function(…){…})(args)`).
        // Strip `export default` and any trailing semicolon/whitespace.
        const normalizedCode = result.code
          .replace(/^export default /, '')
          .replace(/;?\s*$/, '')

        return {
          code: `export default ${JSON.stringify(normalizedCode)};`,
          map: null,
        }
      },
    },
  }
}
