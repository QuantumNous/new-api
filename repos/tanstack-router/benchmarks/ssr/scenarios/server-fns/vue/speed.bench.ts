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
    'ssr server-fn GET (vue)',
    () => runServerFnGetRequestLoop(handler, context),
    serverFnBenchOptions,
  )

  bench(
    'ssr server-fn POST (vue)',
    () => runServerFnPostRequestLoop(handler, context),
    serverFnBenchOptions,
  )

  bench(
    'ssr server-fn redirect (vue)',
    () => runServerFnRedirectRequestLoop(handler, context),
    serverFnBenchOptions,
  )

  bench(
    'ssr server-fn not-found (vue)',
    () => runServerFnNotFoundRequestLoop(handler, context),
    serverFnBenchOptions,
  )

  bench(
    'ssr server-fn send-context (vue)',
    () => runServerFnSendContextRequestLoop(handler, context),
    serverFnBenchOptions,
  )

  bench(
    'ssr server-fn during document ssr (vue)',
    () => runServerFnDocumentSsrRequestLoop(handler),
    serverFnBenchOptions,
  )
})
