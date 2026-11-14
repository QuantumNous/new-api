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
    'ssr redirect (react)',
    () => runRedirectLoop(handler),
    controlFlowBenchOptions,
  )

  bench(
    'ssr not-found (react)',
    () => runNotFoundLoop(handler),
    controlFlowBenchOptions,
  )

  bench(
    'ssr control-flow error 500 (react)',
    () => runErrorLoop(handler),
    controlFlowBenchOptions,
  )

  bench(
    'ssr control-flow unmatched 404 (react)',
    () => runUnmatchedLoop(handler),
    controlFlowBenchOptions,
  )

  bench(
    'ssr control-flow route headers (react)',
    () => runRouteHeadersLoop(handler),
    controlFlowBenchOptions,
  )
})
