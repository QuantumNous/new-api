import * as Solid from 'solid-js'
import {
  createNonReactiveMutableStore,
  createNonReactiveReadonlyStore,
} from '@tanstack/router-core'
import { isServer } from '@tanstack/router-core/isServer'
import type {
  AnyRoute,
  GetStoreConfig,
  RouterReadableStore,
  RouterStores,
  RouterWritableStore,
} from '@tanstack/router-core'

declare module '@tanstack/router-core' {
  export interface RouterStores<in out TRouteTree extends AnyRoute> {
    /** Maps each active routeId to the matchId of its child in the match tree. */
    childMatchIdByRouteId: RouterReadableStore<Record<string, string>>
    /** Maps each pending routeId to true for quick lookup. */
    pendingRouteIds: RouterReadableStore<Record<string, boolean>>
  }
}

function initRouterStores(
  stores: RouterStores<AnyRoute>,
  createReadonlyStore: <TValue>(
    read: () => TValue,
  ) => RouterReadableStore<TValue>,
) {
  stores.childMatchIdByRouteId = createReadonlyStore(() => {
    const ids = stores.matchesId.get()
    const obj: Record<string, string> = {}
    for (let i = 0; i < ids.length - 1; i++) {
      const parentStore = stores.matchStores.get(ids[i]!)
      if (parentStore?.routeId) {
        obj[parentStore.routeId] = ids[i + 1]!
      }
    }
    return obj
  })

  stores.pendingRouteIds = createReadonlyStore(() => {
    const ids = stores.pendingIds.get()
    const obj: Record<string, boolean> = {}
    for (const id of ids) {
      const store = stores.pendingMatchStores.get(id)
      if (store?.routeId) {
        obj[store.routeId] = true
      }
    }
    return obj
  })
}

function createSolidMutableStore<TValue>(
  initialValue: TValue,
): RouterWritableStore<TValue> {
  const [signal, setSignal] = Solid.createSignal(initialValue)

  return { get: signal, set: setSignal }
}

let finalizationRegistry: FinalizationRegistry<() => void> | null = null
if (typeof globalThis !== 'undefined' && 'FinalizationRegistry' in globalThis) {
  finalizationRegistry = new FinalizationRegistry((cb) => cb())
}

function createSolidReadonlyStore<TValue>(
  read: () => TValue,
): RouterReadableStore<TValue> {
  let dispose!: () => void
  const memo = Solid.createRoot((d) => {
    dispose = d
    return Solid.createMemo(read)
  })
  const store = { get: memo }
  finalizationRegistry?.register(store, dispose)
  return store
}

export const getStoreFactory: GetStoreConfig = (opts) => {
  if (isServer ?? opts.isServer) {
    return {
      createMutableStore: createNonReactiveMutableStore,
      createReadonlyStore: createNonReactiveReadonlyStore,
      batch: (fn) => fn(),
      init: (stores) =>
        initRouterStores(stores, createNonReactiveReadonlyStore),
    }
  }

  return {
    createMutableStore: createSolidMutableStore,
    createReadonlyStore: createSolidReadonlyStore,
    batch: Solid.batch,
    init: (stores) => initRouterStores(stores, createSolidReadonlyStore),
  }
}
