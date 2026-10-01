import { bench, describe } from 'vitest'
import { runSsrRequestLoop } from '../bench-utils'
import type { StartRequestHandler } from '../bench-utils'

const appModuleUrl = new URL('./dist/server/server.js', import.meta.url).href
const benchmarkSeed = 0xdeadbeef

const { default: handler } = (await import(
  /* @vite-ignore */ appModuleUrl
)) as {
  default: StartRequestHandler
}

describe('ssr', () => {
  bench(
    'ssr request loop (vue)',
    () => runSsrRequestLoop(handler, { seed: benchmarkSeed }),
    {
      warmupIterations: 100,
      time: 10_000,
      throws: true,
    },
  )
})
