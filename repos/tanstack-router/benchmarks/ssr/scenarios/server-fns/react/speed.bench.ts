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
    'ssr server-fn GET (react)',
    () => runServerFnGetRequestLoop(handler, context),
    serverFnBenchOptions,
  )

  bench(
    'ssr server-fn POST (react)',
    () => runServerFnPostRequestLoop(handler, context),
    serverFnBenchOptions,
  )

  bench(
    'ssr server-fn redirect (react)',
    () => runServerFnRedirectRequestLoop(handler, context),
    serverFnBenchOptions,
  )

  bench(
    'ssr server-fn not-found (react)',
    () => runServerFnNotFoundRequestLoop(handler, context),
    serverFnBenchOptions,
  )

  bench(
    'ssr server-fn send-context (react)',
    () => runServerFnSendContextRequestLoop(handler, context),
    serverFnBenchOptions,
  )

  bench(
    'ssr server-fn during document ssr (react)',
    () => runServerFnDocumentSsrRequestLoop(handler),
    serverFnBenchOptions,
  )
})
