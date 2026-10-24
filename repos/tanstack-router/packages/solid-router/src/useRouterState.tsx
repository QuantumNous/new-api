import { isServer } from '@tanstack/router-core/isServer'
import * as Solid from 'solid-js'
import { replaceEqualDeep } from '@tanstack/router-core'
import { useRouter } from './useRouter'
import type {
  AnyRouter,
  RegisteredRouter,
  RouterState,
} from '@tanstack/router-core'
import type { Accessor } from 'solid-js'

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
): Accessor<UseRouterStateResult<TRouter, TSelected>> {
  const contextRouter = useRouter<TRouter>({
    warn: opts?.router === undefined,
  })
  const router = opts?.router || contextRouter

  // During SSR we render exactly once and do not need reactivity.
  // Avoid subscribing to the store on the server since the server store
  // implementation does not provide subscribe() semantics.
  const _isServer = isServer ?? router.isServer
  if (_isServer) {
    const state = router.stores.__store.get() as RouterState<
      TRouter['routeTree']
    >
    const selected = (
      opts?.select ? opts.select(state) : state
    ) as UseRouterStateResult<TRouter, TSelected>
    return (() => selected) as Accessor<
      UseRouterStateResult<TRouter, TSelected>
    >
  }

  if (!opts?.select) {
    return (() => router.stores.__store.get()) as Accessor<
      UseRouterStateResult<TRouter, TSelected>
    >
  }

  const select = opts.select

  return Solid.createMemo((prev: TSelected | undefined) => {
    const res = select(router.stores.__store.get())
    if (prev === undefined) return res
    return replaceEqualDeep(prev, res)
  }) as Accessor<UseRouterStateResult<TRouter, TSelected>>
}
