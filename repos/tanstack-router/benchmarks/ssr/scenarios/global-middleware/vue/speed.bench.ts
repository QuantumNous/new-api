import { bench, describe } from 'vitest'
import {
  assertGlobalMiddlewareScenario,
  globalMiddlewareBenchOptions,
  runGlobalMiddlewareDocumentLoop,
  runGlobalMiddlewareServerFnLoop,
  runGlobalMiddlewareServerRouteLoop,
  setupGlobalMiddlewareBench,
} from '../bench'
import type { StartRequestHandler } from '../bench'

const appModuleUrl = new URL('./dist/server/server.js', import.meta.url).href

const { default: handler } = (await import(
  /* @vite-ignore */ appModuleUrl
)) as {
  default: StartRequestHandler
}

const context = await setupGlobalMiddlewareBench(handler)

await assertGlobalMiddlewareScenario(handler, context)

describe('ssr', () => {
  bench(
    'ssr global-mw document (vue)',
    () => runGlobalMiddlewareDocumentLoop(handler),
    globalMiddlewareBenchOptions,
  )

  bench(
    'ssr global-mw server-fn (vue)',
    () => runGlobalMiddlewareServerFnLoop(handler, context),
    globalMiddlewareBenchOptions,
  )

  bench(
    'ssr global-mw server-route (vue)',
    () => runGlobalMiddlewareServerRouteLoop(handler),
    globalMiddlewareBenchOptions,
  )
})
