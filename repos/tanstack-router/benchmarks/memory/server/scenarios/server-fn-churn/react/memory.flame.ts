import { runServerFlameBenchmark } from '#memory-server/flame-runner'
import { workloadGroup } from './setup.ts'

await runServerFlameBenchmark(workloadGroup)
