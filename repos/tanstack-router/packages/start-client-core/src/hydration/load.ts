import type { HydrationPrefetchStrategy } from './types'

const loadType = 'load'

const loadStrategy: HydrationPrefetchStrategy<typeof loadType> = {
  _t: loadType,
  _d: () => false,
  _s: ({ gate, prefetch }) => {
    ;(prefetch ?? gate!.resolve)()
  },
}

/* @__NO_SIDE_EFFECTS__ */
export function load(): HydrationPrefetchStrategy<typeof loadType> {
  return loadStrategy
}
