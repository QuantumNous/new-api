import { bench, describe } from 'vitest'
import {
  assertAssetsScenario,
  assetsBenchOptions,
  runAssetsInlineLoop,
  runAssetsLinkedControlLoop,
  type StartRequestHandler,
} from '../shared'

const appModuleUrl = new URL('./dist/server/server.js', import.meta.url).href

const { default: handler } = (await import(
  /* @vite-ignore */ appModuleUrl
)) as {
  default: StartRequestHandler
}

await assertAssetsScenario(handler)

describe('ssr', () => {
  bench(
    'ssr assets inline-css cdn (react)',
    () => runAssetsInlineLoop(handler),
    assetsBenchOptions,
  )
  bench(
    'ssr assets linked-css control (react)',
    () => runAssetsLinkedControlLoop(handler),
    assetsBenchOptions,
  )
})
