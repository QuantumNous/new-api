export const fixedTimestamp = 1_700_000_000_000

type SlowLoaderPayload = {
  id: string
  kind: 'slow'
  ts: number
}

type SlowLoaderDeferred = {
  promise: Promise<SlowLoaderPayload>
  resolve: () => void
}

export const slowLoaderRegistry = new Map<string, SlowLoaderDeferred>()

export function getSlowLoaderDeferred(id: string) {
  const existing = slowLoaderRegistry.get(id)

  if (existing) {
    return existing
  }

  let resolvePromise!: (payload: SlowLoaderPayload) => void
  const promise = new Promise<SlowLoaderPayload>((resolve) => {
    resolvePromise = resolve
  })

  const deferred: SlowLoaderDeferred = {
    promise,
    resolve() {
      slowLoaderRegistry.delete(id)
      resolvePromise({ id, kind: 'slow', ts: fixedTimestamp })
    },
  }

  slowLoaderRegistry.set(id, deferred)
  return deferred
}

export function resolveSlowLoader(id: string) {
  const deferred = slowLoaderRegistry.get(id)

  if (!deferred) {
    throw new Error(`No pending slow loader for id: ${id}`)
  }

  deferred.resolve()
}

export function resolveAllSlowLoaders() {
  for (const id of Array.from(slowLoaderRegistry.keys())) {
    resolveSlowLoader(id)
  }
}
