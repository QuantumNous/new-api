import { bench, describe } from 'vitest'
import {
  assertSelectiveSanity,
  benchOptions,
  runSelectiveLoop,
  type StartRequestHandler,
} from '../shared-bench'

const appModuleUrl = new URL('./dist/server/server.js', import.meta.url).href

const { default: handler } = (await import(
  /* @vite-ignore */ appModuleUrl
)) as {
  default: StartRequestHandler
}

await assertSelectiveSanity(handler)

describe('ssr', () => {
  bench('ssr selective (react)', () => runSelectiveLoop(handler), benchOptions)
})
