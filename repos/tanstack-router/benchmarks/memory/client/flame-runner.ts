import { profileFlameWorkload } from '../flame-control.ts'
import { window } from './jsdom.ts'
import type { ClientMemoryWorkload } from './benchmark.ts'

export async function runClientFlameBenchmark(workload: ClientMemoryWorkload) {
  try {
    await workload.sanity()
    await workload.before?.()
    await profileFlameWorkload(workload.run, workload.name)
  } finally {
    await workload.after?.()
    window.close()
  }
}
