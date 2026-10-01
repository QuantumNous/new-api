import { afterAll, beforeAll, bench, describe } from 'vitest'
import { memoryBenchOptions } from '#memory-client/bench-utils'
import { workload } from './setup'

await workload.sanity()

describe('memory', () => {
  if (workload.before && workload.after) {
    beforeAll(workload.before)
    afterAll(workload.after)

    bench(workload.name, workload.run, {
      ...memoryBenchOptions,
      setup: workload.before,
      teardown: workload.after,
    })
    return
  }

  bench(workload.name, workload.run, memoryBenchOptions)
})
