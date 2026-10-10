import { bench, describe } from 'vitest'
import {
  assertBeforeLoadScenario,
  beforeLoadBenchOptions,
  runBeforeLoadLoop,
  type StartRequestHandler,
} from '../shared-bench'

const appModuleUrl = new URL('./dist/server/server.js', import.meta.url).href

const { default: handler } = (await import(
  /* @vite-ignore */ appModuleUrl
)) as {
  default: StartRequestHandler
}

await assertBeforeLoadScenario(handler)

describe('ssr', () => {
  bench(
    'ssr before-load chain (solid)',
    () => runBeforeLoadLoop(handler),
    beforeLoadBenchOptions,
  )
})
