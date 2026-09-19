import { bench, describe } from 'vitest'
import {
  assertServerFnTransportScenario,
  runServerFnMultipartRequestLoop,
  runServerFnRawResponseRequestLoop,
  runServerFnRawStreamRequestLoop,
  serverFnTransportBenchOptions,
  setupServerFnTransportBench,
} from '../bench'
import type { StartRequestHandler } from '../bench'

const { default: handler } = (await import(
  /* @vite-ignore */ new URL('./dist/server/server.js', import.meta.url).href
)) as {
  default: StartRequestHandler
}

const context = await setupServerFnTransportBench(handler)

await assertServerFnTransportScenario(handler, context)

describe('ssr', () => {
  bench(
    'ssr server-fn multipart (solid)',
    () => runServerFnMultipartRequestLoop(handler, context),
    serverFnTransportBenchOptions,
  )

  bench(
    'ssr server-fn raw-response (solid)',
    () => runServerFnRawResponseRequestLoop(handler, context),
    serverFnTransportBenchOptions,
  )

  bench(
    'ssr server-fn raw-stream (solid)',
    () => runServerFnRawStreamRequestLoop(handler, context),
    serverFnTransportBenchOptions,
  )
})
