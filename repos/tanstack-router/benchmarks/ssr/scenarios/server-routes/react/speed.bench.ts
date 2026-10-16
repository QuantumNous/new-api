import { bench, describe } from 'vitest'
import {
  assertServerRouteResponse,
  runServerRouteLoop,
  serverRouteBenchOptions,
} from '../shared'
import type { StartRequestHandler } from '../shared'

const appModuleUrl = new URL('./dist/server/server.js', import.meta.url).href

const { default: handler } = (await import(
  /* @vite-ignore */ appModuleUrl
)) as {
  default: StartRequestHandler
}

await assertServerRouteResponse(handler)

describe('ssr', () => {
  bench(
    'ssr server-route (react)',
    () => runServerRouteLoop(handler),
    serverRouteBenchOptions,
  )
})
