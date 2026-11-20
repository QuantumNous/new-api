import { createLRUCache } from './lru-cache'
import { arraysEqual, functionalUpdate } from './utils'

import type { AnyRoute } from './route'
import type { RouterState } from './router'
import type { FullSearchSchema } from './routeInfo'
import type { ParsedLocation } from './location'
import type { AnyRedirect } from './redirect'
import type { AnyRouteMatch } from './Matches'

export interface RouterReadableStore<TValue> {
  get: () => TValue
}

export interface RouterWritableStore<
  TValue,
> extends RouterReadableStore<TValue> {
  set: ((updater: (prev: TValue) => TValue) => void) & ((value: TValue) => void)
}

export type RouterBatchFn = (fn: () => void) => void

export type MutableStoreFactory = <TValue>(
  initialValue: TValue,
) => RouterWritableStore<TValue>

export type ReadonlyStoreFactory = <TValue>(
  read: () => TValue,
) => RouterReadableStore<TValue>

export type GetStoreConfig = (opts: { isServer?: boolean }) => StoreConfig

export type StoreConfig = {
  createMutableStore: MutableStoreFactory
  createReadonlyStore: ReadonlyStoreFactory
  batch: RouterBatchFn
  init?: (stores: RouterStores<AnyRoute>) => void
}

type MatchStore = RouterWritableStore<AnyRouteMatch> & {
  routeId?: string
}
type ReadableStore<TValue> = RouterReadableStore<TValue>

/** SSR non-reactive createMutableStore */
export function createNonReactiveMutableStore<TValue>(
  initialValue: TValue,
): RouterWritableStore<TValue> {
  let value = initialValue

  return {
    get() {
      return value
    },
    set(nextOrUpdater: TValue | ((prev: TValue) => TValue)) {
      value = functionalUpdate(nextOrUpdater, value)
    },
  }
}

/** SSR non-reactive createReadonlyStore */
export function createNonReactiveReadonlyStore<TValue>(
  read: () => TValue,
): RouterReadableStore<TValue> {
  return {
    get() {
      return read()
    },
  }
}

export interface RouterStores<in out TRouteTree extends AnyRoute> {
  status: RouterWritableStore<RouterState<TRouteTree>['status']>
  loadedAt: RouterWritableStore<number>
  isLoading: RouterWritableStore<boolean>
  isTransitioning: RouterWritableStore<boolean>
  location: RouterWritableStore<ParsedLocation<FullSearchSchema<TRouteTree>>>
  resolvedLocation: RouterWritableStore<
    ParsedLocation<FullSearchSchema<TRouteTree>> | undefined
  >
  statusCode: RouterWritableStore<number>
  redirect: RouterWritableStore<AnyRedirect | undefined>
  matchesId: RouterWritableStore<Array<string>>
  pendingIds: RouterWritableStore<Array<string>>
  /** @internal */
  cachedIds: RouterWritableStore<Array<string>>
  matches: ReadableStore<Array<AnyRouteMatch>>
  pendingMatches: ReadableStore<Array<AnyRouteMatch>>
  cachedMatches: ReadableStore<Array<AnyRouteMatch>>
  firstId: ReadableStore<string | undefined>
  hasPending: ReadableStore<boolean>
  matchRouteDeps: ReadableStore<{
    locationHref: string
    resolvedLocationHref: string | undefined
    status: RouterState<TRouteTree>['status']
  }>
  __store: RouterReadableStore<RouterState<TRouteTree>>

  matchStores: Map<string, MatchStore>
  pendingMatchStores: Map<string, MatchStore>
  cachedMatchStores: Map<string, MatchStore>

  /**
   * Get a computed store that resolves a routeId to its current match state.
   * Returns the same cached store instance for repeated calls with the same key.
   * The computed depends on matchesId + the individual match store, so
   * subscribers are only notified when the resolved match state changes.
   */
  getRouteMatchStore: (
    routeId: string,
  ) => RouterReadableStore<AnyRouteMatch | undefined>

  setMatches: (nextMatches: Array<AnyRouteMatch>) => void
  setPending: (nextMatches: Array<AnyRouteMatch>) => void
  setCached: (nextMatches: Array<AnyRouteMatch>) => void
}

export function createRouterStores<TRouteTree extends AnyRoute>(
  initialState: RouterState<TRouteTree>,
  config: StoreConfig,
): RouterStores<TRouteTree> {
  const { createMutableStore, createReadonlyStore, batch, init } = config

  // non reactive utilities
  const matchStores = new Map<string, MatchStore>()
  const pendingMatchStores = new Map<string, MatchStore>()
  const cachedMatchStores = new Map<string, MatchStore>()

  // atoms
  const status = createMutableStore(initialState.status)
  const loadedAt = createMutableStore(initialState.loadedAt)
  const isLoading = createMutableStore(initialState.isLoading)
  const isTransitioning = createMutableStore(initialState.isTransitioning)
  const location = createMutableStore(initialState.location)
  const resolvedLocation = createMutableStore(initialState.resolvedLocation)
  const statusCode = createMutableStore(initialState.statusCode)
  const redirect = createMutableStore(initialState.redirect)
  const matchesId = createMutableStore<Array<string>>([])
  const pendingIds = createMutableStore<Array<string>>([])
  const cachedIds = createMutableStore<Array<string>>([])

  // 1st order derived stores
  const matches = createReadonlyStore(() =>
    readPoolMatches(matchStores, matchesId.get()),
  )
  const pendingMatches = createReadonlyStore(() =>
    readPoolMatches(pendingMatchStores, pendingIds.get()),
  )
  const cachedMatches = createReadonlyStore(() =>
    readPoolMatches(cachedMatchStores, cachedIds.get()),
  )
  const firstId = createReadonlyStore(() => matchesId.get()[0])
  const hasPending = createReadonlyStore(() =>
    matchesId.get().some((matchId) => {
      const store = matchStores.get(matchId)
      return store?.get().status === 'pending'
    }),
  )
  const matchRouteDeps = createReadonlyStore(() => ({
    locationHref: location.get().href,
    resolvedLocationHref: resolvedLocation.get()?.href,
    status: status.get(),
  }))

  // compatibility "big" state store
  const __store = createReadonlyStore(() => ({
    status: status.get(),
    loadedAt: loadedAt.get(),
    isLoading: isLoading.get(),
    isTransitioning: isTransitioning.get(),
    matches: matches.get(),
    location: location.get(),
    resolvedLocation: resolvedLocation.get(),
    statusCode: statusCode.get(),
    redirect: redirect.get(),
  }))

  // Per-routeId computed store cache.
  // Each entry resolves routeId → match state through the signal graph,
  // giving consumers a single store to subscribe to instead of the
  // two-level byRouteId → matchStore pattern.
  //
  // 64 max size is arbitrary, this is only for active matches anyway so
  // it should be plenty. And we already have a 32 limit due to route
  // matching bitmask anyway.
  const matchStoreByRouteIdCache = createLRUCache<
    string,
    RouterReadableStore<AnyRouteMatch | undefined>
  >(64)

  function getRouteMatchStore(
    routeId: string,
  ): RouterReadableStore<AnyRouteMatch | undefined> {
    let cached = matchStoreByRouteIdCache.get(routeId)
    if (!cached) {
      cached = createReadonlyStore(() => {
        // Reading matchesId.get() tracks it as a dependency.
        // When matchesId changes (navigation), this computed re-evaluates.
        const ids = matchesId.get()
        for (const id of ids) {
          const matchStore = matchStores.get(id)
          if (matchStore && matchStore.routeId === routeId) {
            // Reading matchStore.get() tracks it as a dependency.
            // When the match store's state changes, this re-evaluates.
            return matchStore.get()
          }
        }
        return undefined
      })
      matchStoreByRouteIdCache.set(routeId, cached)
    }
    return cached
  }

  const store = {
    // atoms
    status,
    loadedAt,
    isLoading,
    isTransitioning,
    location,
    resolvedLocation,
    statusCode,
    redirect,
    matchesId,
    pendingIds,
    cachedIds,

    // derived
    matches,
    pendingMatches,
    cachedMatches,
    firstId,
    hasPending,
    matchRouteDeps,

    // non-reactive state
    matchStores,
    pendingMatchStores,
    cachedMatchStores,

    // compatibility "big" state
    __store,

    // per-key computed stores
    getRouteMatchStore,

    // methods
    setMatches,
    setPending,
    setCached,
  }

  // initialize the active matches
  setMatches(initialState.matches as Array<AnyRouteMatch>)
  init?.(store)

  // setters to update non-reactive utilities in sync with the reactive stores
  function setMatches(nextMatches: Array<AnyRouteMatch>) {
    reconcileMatchPool(
      nextMatches,
      matchStores,
      matchesId,
      createMutableStore,
      batch,
    )
  }

  function setPending(nextMatches: Array<AnyRouteMatch>) {
    reconcileMatchPool(
      nextMatches,
      pendingMatchStores,
      pendingIds,
      createMutableStore,
      batch,
    )
  }

  function setCached(nextMatches: Array<AnyRouteMatch>) {
    reconcileMatchPool(
      nextMatches,
      cachedMatchStores,
      cachedIds,
      createMutableStore,
      batch,
    )
  }

  return store
}

function readPoolMatches(
  pool: Map<string, MatchStore>,
  ids: Array<string>,
): Array<AnyRouteMatch> {
  const matches: Array<AnyRouteMatch> = []
  for (const id of ids) {
    const matchStore = pool.get(id)
    if (matchStore) {
      matches.push(matchStore.get())
    }
  }
  return matches
}

function reconcileMatchPool(
  nextMatches: Array<AnyRouteMatch>,
  pool: Map<string, MatchStore>,
  idStore: RouterWritableStore<Array<string>>,
  createMutableStore: MutableStoreFactory,
  batch: RouterBatchFn,
): void {
  const nextIds = nextMatches.map((d) => d.id)
  const nextIdSet = new Set(nextIds)

  batch(() => {
    for (const id of pool.keys()) {
      if (!nextIdSet.has(id)) {
        pool.delete(id)
      }
    }

    for (const nextMatch of nextMatches) {
      const existing = pool.get(nextMatch.id)
      if (!existing) {
        const matchStore = createMutableStore(nextMatch) as MatchStore
        matchStore.routeId = nextMatch.routeId
        pool.set(nextMatch.id, matchStore)
        continue
      }

      existing.routeId = nextMatch.routeId
      if (existing.get() !== nextMatch) {
        existing.set(nextMatch)
      }
    }

    if (!arraysEqual(idStore.get(), nextIds)) {
      idStore.set(nextIds)
    }
  })
}
