import { runClientFlameBenchmark } from '#memory-client/flame-runner'
import { workload } from './setup.ts'

await runClientFlameBenchmark(workload)
