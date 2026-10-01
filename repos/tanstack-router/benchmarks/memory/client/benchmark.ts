export interface ClientMemoryWorkload {
  name: string
  before?: () => Promise<void> | void
  run: () => Promise<void> | void
  sanity: () => Promise<void> | void
  after?: () => Promise<void> | void
}
