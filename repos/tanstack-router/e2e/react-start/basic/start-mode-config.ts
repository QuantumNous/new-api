import { isPrerender } from './tests/utils/isPrerender'
import { isSpaMode } from './tests/utils/isSpaMode'

const rsbuildClientOutput: 'module' | 'iife' | undefined = (() => {
  const output = process.env.TSS_RSB_CLIENT_OUTPUT

  if (output === undefined) return undefined
  if (output === 'module') return 'module'
  if (output === 'iife') return 'iife'

  throw new Error(
    `Invalid TSS_RSB_CLIENT_OUTPUT: ${output}. Expected "module" or "iife".`,
  )
})()

export function getStartModeConfig() {
  return {
    spa: isSpaMode
      ? {
          enabled: true,
          prerender: {
            outputPath: 'index.html',
          },
        }
      : undefined,
    prerender: isPrerender
      ? {
          enabled: true,
          filter: (page: { path: string }) =>
            ![
              '/this-route-does-not-exist',
              '/redirect',
              '/i-do-not-exist',
              '/not-found',
              '/primitive-beforeload-error',
              '/specialChars/search',
              '/specialChars/hash',
              '/specialChars/malformed',
              '/users',
            ].some((p) => page.path.includes(p)),
          maxRedirects: 100,
        }
      : undefined,
    rsbuild: rsbuildClientOutput
      ? {
          client: {
            output: rsbuildClientOutput,
          },
        }
      : undefined,
  }
}
