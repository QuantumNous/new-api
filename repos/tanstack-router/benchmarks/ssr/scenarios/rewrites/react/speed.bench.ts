import { bench, describe } from 'vitest'
import {
  assertRewriteScenario,
  rewriteBenchOptions,
  runRewriteLocalizedLoop,
  runRewritePassthroughLoop,
  type StartRequestHandler,
} from '../shared'

const appModuleUrl = new URL('./dist/server/server.js', import.meta.url).href

const { default: handler } = (await import(
  /* @vite-ignore */ appModuleUrl
)) as {
  default: StartRequestHandler
}

await assertRewriteScenario(handler)

describe('ssr', () => {
  bench(
    'ssr rewrite localized (react)',
    () => runRewriteLocalizedLoop(handler),
    rewriteBenchOptions,
  )
  bench(
    'ssr rewrite passthrough (react)',
    () => runRewritePassthroughLoop(handler),
    rewriteBenchOptions,
  )
})
