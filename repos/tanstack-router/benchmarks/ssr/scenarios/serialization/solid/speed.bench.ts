import { bench, describe } from 'vitest'
import {
  assertSerializationScenario,
  runPlainSerializationLoop,
  runRichSerializationLoop,
  serializationBenchOptions,
  type StartRequestHandler,
} from '../shared-bench'

const appModuleUrl = new URL('./dist/server/server.js', import.meta.url).href

const { default: handler } = (await import(
  /* @vite-ignore */ appModuleUrl
)) as {
  default: StartRequestHandler
}

await assertSerializationScenario(handler)

describe('ssr', () => {
  bench(
    'ssr dehydrate rich types (solid)',
    () => runRichSerializationLoop(handler),
    serializationBenchOptions,
  )

  bench(
    'ssr dehydrate plain control (solid)',
    () => runPlainSerializationLoop(handler),
    serializationBenchOptions,
  )
})
