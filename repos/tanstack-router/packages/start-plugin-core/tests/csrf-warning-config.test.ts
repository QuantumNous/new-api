import { describe, expect, test } from 'vitest'
import { parseStartConfig as parseViteStartConfig } from '../src/vite/schema'
import { parseStartConfig as parseRsbuildStartConfig } from '../src/rsbuild/schema'
import { createViteDefineConfig } from '../src/vite/planning'

const root = process.cwd()
const corePluginOpts = { framework: 'react' as const }

describe('disableCsrfMiddlewareWarning plugin config', () => {
  test('is accepted by the vite plugin config', () => {
    const config = parseViteStartConfig(
      {
        serverFns: {
          disableCsrfMiddlewareWarning: true,
        },
      },
      corePluginOpts,
      root,
    )

    expect(config.serverFns.disableCsrfMiddlewareWarning).toBe(true)
  })

  test('is accepted by the rsbuild plugin config', () => {
    const config = parseRsbuildStartConfig(
      {
        serverFns: {
          disableCsrfMiddlewareWarning: true,
        },
      },
      corePluginOpts,
      root,
    )

    expect(config.serverFns.disableCsrfMiddlewareWarning).toBe(true)
  })

  test('defaults to false', () => {
    const config = parseViteStartConfig({}, corePluginOpts, root)

    expect(config.serverFns.disableCsrfMiddlewareWarning).toBe(false)
  })

  test('emits the vite define used by the server runtime', () => {
    const define = createViteDefineConfig({
      command: 'serve',
      mode: 'development',
      serverFnBase: '/_serverFn',
      routerBasepath: '/',
      spaEnabled: true,
      devSsrStylesEnabled: true,
      devSsrStylesBasepath: '/',
      inlineCssEnabled: false,
      staticNodeEnv: true,
      disableCsrfMiddlewareWarning: true,
    })

    expect(define['process.env.TSS_DISABLE_CSRF_MIDDLEWARE_WARNING']).toBe(
      JSON.stringify('true'),
    )
    expect(define['import.meta.env.TSS_DISABLE_CSRF_MIDDLEWARE_WARNING']).toBe(
      JSON.stringify('true'),
    )
  })
})
