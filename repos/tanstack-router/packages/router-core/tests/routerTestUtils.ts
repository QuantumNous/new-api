import { batch, createAtom } from '@tanstack/store'
import { isServer } from '@tanstack/router-core/isServer'
import {
  RouterCore,
  createNonReactiveMutableStore,
  createNonReactiveReadonlyStore,
} from '../src'
import type { RouterHistory } from '@tanstack/history'
import type {
  AnyRoute,
  GetStoreConfig,
  RouterConstructorOptions,
  TrailingSlashOption,
} from '../src'

const getStoreConfig: GetStoreConfig = (opts) => {
  if (isServer ?? opts.isServer) {
    return {
      createMutableStore: createNonReactiveMutableStore,
      createReadonlyStore: createNonReactiveReadonlyStore,
      batch: (fn) => fn(),
    }
  }

  return {
    createMutableStore: createAtom,
    createReadonlyStore: createAtom,
    batch,
  }
}

export function createTestRouter<
  TRouteTree extends AnyRoute,
  TTrailingSlashOption extends TrailingSlashOption = 'never',
  TDefaultStructuralSharingOption extends boolean = false,
  TRouterHistory extends RouterHistory = RouterHistory,
  TDehydrated extends Record<string, any> = Record<string, any>,
>(
  options: RouterConstructorOptions<
    TRouteTree,
    TTrailingSlashOption,
    TDefaultStructuralSharingOption,
    TRouterHistory,
    TDehydrated
  >,
) {
  return new RouterCore(options, getStoreConfig)
}
