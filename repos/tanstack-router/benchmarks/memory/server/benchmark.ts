export interface ServerMemoryWorkload {
  name: string
  run: () => Promise<void> | void
}

export interface ServerMemoryWorkloadGroup {
  sanity: () => Promise<void> | void
  workloads: Array<ServerMemoryWorkload>
}
