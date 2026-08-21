import { bench, describe } from 'vitest'
import { memoryBenchOptions } from '#memory-server/bench-utils'
import { workloadGroup } from './setup'

await workloadGroup.sanity()

describe('memory', () => {
  for (const workload of workloadGroup.workloads) {
    bench(workload.name, workload.run, memoryBenchOptions)
  }
})
