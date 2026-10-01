import { afterAll, beforeAll, bench, describe } from 'vitest'
import { setup } from './setup'

describe('client-nav', () => {
  const test = setup()

  /**
   * Running `vitest bench` ignores "suite hooks" like `beforeAll` and `afterAll`,
   * so we use tinybench's `setup` and `teardown` options to run our setup and teardown logic.
   *
   * But CodSpeed calls the benchmarked function directly, bypassing `setup` and `teardown`,
   * but it does support `beforeAll` and `afterAll`.
   *
   * So it looks like we're setting up in duplicate, but in reality, it's only running once per environment, as intended.
   */

  beforeAll(test.before)
  afterAll(test.after)

  bench(
    'client-side navigation loop (solid)',
    async () => {
      for (let i = 0; i < 10; i++) {
        await test.tick()
      }
    },
    {
      warmupIterations: 100,
      time: 10_000,
      setup: test.before,
      teardown: test.after,
    },
  )
})
