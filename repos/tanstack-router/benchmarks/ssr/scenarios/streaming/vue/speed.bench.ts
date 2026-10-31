import { bench, describe } from 'vitest'
import {
  assertStreamingSanity,
  benchOptions,
  runStreamingLoop,
  type StartRequestHandler,
} from '../shared-bench'

const appModuleUrl = new URL('./dist/server/server.js', import.meta.url).href

const { default: handler } = (await import(
  /* @vite-ignore */ appModuleUrl
)) as {
  default: StartRequestHandler
}

await assertStreamingSanity(handler)

describe('ssr', () => {
  bench(
    'ssr streaming deferred (vue)',
    () => runStreamingLoop(handler),
    benchOptions,
  )
})
