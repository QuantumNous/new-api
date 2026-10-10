'use client'

import { useStore } from '@tanstack/react-store'
import { isServer } from '@tanstack/router-core/isServer'
import { useRouter } from './useRouter'
import { useStructuralSharing } from './useMatch'
import type {
  AnyRouter,
  RegisteredRouter,
  RouterState,
} from '@tanstack/router-core'
import type {
  StructuralSharingOption,
  ValidateSelected,
} from './structuralSharing'

export type UseRouterStateOptions<
  TRouter extends AnyRouter,
  TSelected,
  TStructuralSharing,
> = {
  router?: TRouter
  select?: (
    state: RouterState<TRouter['routeTree']>,
  ) => ValidateSelected<TRouter, TSelected, TStructuralSharing>
} & StructuralSharingOption<TRouter, TSelected, TStructuralSharing>

export type UseRouterStateResult<
  TRouter extends AnyRouter,
  TSelected,
> = unknown extends TSelected ? RouterState<TRouter['routeTree']> : TSelected

/**
 * Subscribe to the router's state store with optional selection and
 * structural sharing for render optimization.
 *
 * Options:
 * - `select`: Project the full router state to a derived slice
 * - `structuralSharing`: Replace-equal semantics for stable references
 * - `router`: Read state from a specific router instance instead of context
 *
 * @returns The selected router state (or the full state by default).
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/useRouterStateHook
 */
export function useRouterState<
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
  TStructuralSharing extends boolean = boolean,
>(
  opts?: UseRouterStateOptions<TRouter, TSelected, TStructuralSharing>,
): UseRouterStateResult<TRouter, TSelected> {
  const contextRouter = useRouter<TRouter>({
    warn: opts?.router === undefined,
  })
  const router = opts?.router || contextRouter

  // During SSR we render exactly once and do not need reactivity.
  // Avoid subscribing to the store (and any structural sharing work) on the server.
  const _isServer = isServer ?? router.isServer
  if (_isServer) {
    const state = router.stores.__store.get() as RouterState<
      TRouter['routeTree']
    >
    return (opts?.select ? opts.select(state) : state) as UseRouterStateResult<
      TRouter,
      TSelected
    >
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks -- condition is static
  return useStore(
    router.stores.__store,
    // eslint-disable-next-line react-hooks/rules-of-hooks -- condition is static
    useStructuralSharing(opts, router),
  ) as UseRouterStateResult<TRouter, TSelected>
}
