import { bench, describe } from 'vitest'
import { assertHeadSanity, headBenchOptions, runHeadLoop } from '../shared'
import type { StartRequestHandler } from '../shared'

const appModuleUrl = new URL('./dist/server/server.js', import.meta.url).href

const { default: handler } = (await import(
  /* @vite-ignore */ appModuleUrl
)) as {
  default: StartRequestHandler
}

await assertHeadSanity(handler)

describe('ssr', () => {
  bench('ssr head (solid)', () => runHeadLoop(handler), headBenchOptions)
})
