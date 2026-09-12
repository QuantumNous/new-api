import type { ServerMemoryWorkloadGroup } from '#memory-server/benchmark'
import { createWorkloadGroup } from '../shared.ts'
import type { StartRequestHandler } from '../shared.ts'

const appModuleUrl = new URL('./dist/server/server.js', import.meta.url).href

const { default: handler } = (await import(
  /* @vite-ignore */ appModuleUrl
)) as {
  default: StartRequestHandler
}

export const workloadGroup: ServerMemoryWorkloadGroup =
  await createWorkloadGroup('vue', handler)
