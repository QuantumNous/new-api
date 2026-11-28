import { bench, describe } from 'vitest'
import {
  assertServerFnScenario,
  runServerFnDocumentSsrRequestLoop,
  runServerFnGetRequestLoop,
  runServerFnNotFoundRequestLoop,
  runServerFnPostRequestLoop,
  runServerFnRedirectRequestLoop,
  runServerFnSendContextRequestLoop,
  serverFnBenchOptions,
  setupServerFnBench,
} from '../bench'
import type { StartRequestHandler } from '../bench'

const { default: handler } = (await import(
  /* @vite-ignore */ new URL('./dist/server/server.js', import.meta.url).href
)) as {
  default: StartRequestHandler
}

const context = await setupServerFnBench(handler)

await assertServerFnScenario(handler, context)

describe('ssr', () => {
  bench(
    'ssr server-fn GET (solid)',
    () => runServerFnGetRequestLoop(handler, context),
    serverFnBenchOptions,
  )

  bench(
    'ssr server-fn POST (solid)',
    () => runServerFnPostRequestLoop(handler, context),
    serverFnBenchOptions,
  )

  bench(
    'ssr server-fn redirect (solid)',
    () => runServerFnRedirectRequestLoop(handler, context),
    serverFnBenchOptions,
  )

  bench(
    'ssr server-fn not-found (solid)',
    () => runServerFnNotFoundRequestLoop(handler, context),
    serverFnBenchOptions,
  )

  bench(
    'ssr server-fn send-context (solid)',
    () => runServerFnSendContextRequestLoop(handler, context),
    serverFnBenchOptions,
  )

  bench(
    'ssr server-fn during document ssr (solid)',
    () => runServerFnDocumentSsrRequestLoop(handler),
    serverFnBenchOptions,
  )
})
