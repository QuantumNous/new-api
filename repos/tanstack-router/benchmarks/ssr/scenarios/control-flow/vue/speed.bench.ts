import { bench, describe } from 'vitest'
import {
  assertControlFlowSanity,
  controlFlowBenchOptions,
  runErrorLoop,
  runNotFoundLoop,
  runRedirectLoop,
  runRouteHeadersLoop,
  runUnmatchedLoop,
} from '../shared'
import type { StartRequestHandler } from '../shared'

const appModuleUrl = new URL('./dist/server/server.js', import.meta.url).href

const { default: handler } = (await import(
  /* @vite-ignore */ appModuleUrl
)) as {
  default: StartRequestHandler
}

await assertControlFlowSanity(handler)

describe('ssr', () => {
  bench(
    'ssr redirect (vue)',
    () => runRedirectLoop(handler),
    controlFlowBenchOptions,
  )

  bench(
    'ssr not-found (vue)',
    () => runNotFoundLoop(handler),
    controlFlowBenchOptions,
  )

  bench(
    'ssr control-flow error 500 (vue)',
    () => runErrorLoop(handler),
    controlFlowBenchOptions,
  )

  bench(
    'ssr control-flow unmatched 404 (vue)',
    () => runUnmatchedLoop(handler),
    controlFlowBenchOptions,
  )

  bench(
    'ssr control-flow route headers (vue)',
    () => runRouteHeadersLoop(handler),
    controlFlowBenchOptions,
  )
})
