import { bench, describe } from 'vitest'
import {
  assertLoadersSanity,
  benchOptions,
  runLoadersLoop,
  type StartRequestHandler,
} from '../shared-bench'

const appModuleUrl = new URL('./dist/server/server.js', import.meta.url).href

const { default: handler } = (await import(
  /* @vite-ignore */ appModuleUrl
)) as {
  default: StartRequestHandler
}

await assertLoadersSanity(handler)

describe('ssr', () => {
  bench('ssr loaders (solid)', () => runLoadersLoop(handler), benchOptions)
})
