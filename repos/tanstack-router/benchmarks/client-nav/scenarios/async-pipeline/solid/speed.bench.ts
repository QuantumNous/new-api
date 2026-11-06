import { afterAll, beforeAll, bench, describe } from 'vitest'
import { benchOptions, ticksPerIteration } from '../shared'
import { setup } from './setup'

describe('client-async-pipeline', () => {
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
    'client-async-pipeline navigation loop (solid)',
    async () => {
      for (let i = 0; i < ticksPerIteration; i++) {
        await test.tick()
      }
    },
    {
      ...benchOptions,
      setup: test.before,
      teardown: test.after,
    },
  )
})
