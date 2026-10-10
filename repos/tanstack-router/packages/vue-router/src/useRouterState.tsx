import * as Vue from 'vue'
import { isServer } from '@tanstack/router-core/isServer'
import { useStore } from '@tanstack/vue-store'
import { useRouter } from './useRouter'
import type {
  AnyRouter,
  RegisteredRouter,
  RouterState,
} from '@tanstack/router-core'

export type UseRouterStateOptions<TRouter extends AnyRouter, TSelected> = {
  router?: TRouter
  select?: (state: RouterState<TRouter['routeTree']>) => TSelected
}

export type UseRouterStateResult<
  TRouter extends AnyRouter,
  TSelected,
> = unknown extends TSelected ? RouterState<TRouter['routeTree']> : TSelected

export function useRouterState<
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
>(
  opts?: UseRouterStateOptions<TRouter, TSelected>,
): Vue.Ref<UseRouterStateResult<TRouter, TSelected>> {
  const contextRouter = useRouter<TRouter>({
    warn: opts?.router === undefined,
  })
  const router = opts?.router || contextRouter

  // Return a safe default if router is undefined
  if (!router || !router.stores.__store) {
    return Vue.ref(undefined) as Vue.Ref<
      UseRouterStateResult<TRouter, TSelected>
    >
  }

  // During SSR we render exactly once and do not need reactivity.
  // Avoid subscribing to the store on the server since the server store
  // implementation does not provide subscribe() semantics.
  const _isServer = isServer ?? router.isServer

  if (_isServer) {
    const state = router.stores.__store.get() as RouterState<
      TRouter['routeTree']
    >
    return Vue.ref(opts?.select ? opts.select(state) : state) as Vue.Ref<
      UseRouterStateResult<TRouter, TSelected>
    >
  }

  return useStore(router.stores.__store, (state) => {
    if (opts?.select) return opts.select(state)

    return state
  }) as Vue.Ref<UseRouterStateResult<TRouter, TSelected>>
}
