'use client'

import { useStore } from '@tanstack/react-store'
import { isServer } from '@tanstack/router-core/isServer'
import { useRouter } from './useRouter'
import { useStructuralSharing } from './useMatch'
import type {
  StructuralSharingOption,
  ValidateSelected,
} from './structuralSharing'
import type {
  AnyRouter,
  RegisteredRouter,
  RouterState,
} from '@tanstack/router-core'

export interface UseLocationBaseOptions<
  TRouter extends AnyRouter,
  TSelected,
  TStructuralSharing extends boolean = boolean,
> {
  select?: (
    state: RouterState<TRouter['routeTree']>['location'],
  ) => ValidateSelected<TRouter, TSelected, TStructuralSharing>
}

export type UseLocationResult<
  TRouter extends AnyRouter,
  TSelected,
> = unknown extends TSelected
  ? RouterState<TRouter['routeTree']>['location']
  : TSelected

/**
 * Read the current location from the router state with optional selection.
 * Useful for subscribing to just the pieces of location you care about.
 *
 * Options:
 * - `select`: Project the `location` object to a derived value
 * - `structuralSharing`: Enable structural sharing for stable references
 *
 * @returns The current location (or selected value).
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/useLocationHook
 */
export function useLocation<
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
  TStructuralSharing extends boolean = boolean,
>(
  opts?: UseLocationBaseOptions<TRouter, TSelected, TStructuralSharing> &
    StructuralSharingOption<TRouter, TSelected, TStructuralSharing>,
): UseLocationResult<TRouter, TSelected> {
  const router = useRouter<TRouter>()

  if (isServer ?? router.isServer) {
    const location = router.stores.location.get()
    return (
      opts?.select ? opts.select(location as any) : location
    ) as UseLocationResult<TRouter, TSelected>
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks -- condition is static
  return useStore(
    router.stores.location,
    // eslint-disable-next-line react-hooks/rules-of-hooks -- condition is static
    useStructuralSharing(opts, router),
  ) as UseLocationResult<TRouter, TSelected>
}
