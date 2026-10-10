import { bench, describe } from 'vitest'
import {
  assertServerRouteMiddlewareResponse,
  runServerRouteMiddlewareLoop,
  serverRouteMiddlewareBenchOptions,
} from '../shared'
import type { StartRequestHandler } from '../shared'

const appModuleUrl = new URL('./dist/server/server.js', import.meta.url).href

const { default: handler } = (await import(
  /* @vite-ignore */ appModuleUrl
)) as {
  default: StartRequestHandler
}

await assertServerRouteMiddlewareResponse(handler)

describe('ssr', () => {
  bench(
    'ssr server-route middleware (vue)',
    () => runServerRouteMiddlewareLoop(handler),
    serverRouteMiddlewareBenchOptions,
  )
})
