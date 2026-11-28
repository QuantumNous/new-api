import { profileFlameWorkload } from '../flame-control.ts'
import type { ServerMemoryWorkloadGroup } from './benchmark.ts'

export async function runServerFlameBenchmark(
  workloadGroup: ServerMemoryWorkloadGroup,
) {
  await workloadGroup.sanity()

  for (const workload of workloadGroup.workloads) {
    await profileFlameWorkload(workload.run, workload.name)
  }
}
