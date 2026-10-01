import * as Solid from 'solid-js'
import { invariant, replaceEqualDeep } from '@tanstack/router-core'
import { nearestMatchContext } from './matchContext'
import { useRouter } from './useRouter'
import type {
  AnyRouter,
  MakeRouteMatch,
  MakeRouteMatchUnion,
  RegisteredRouter,
  StrictOrFrom,
  ThrowConstraint,
  ThrowOrOptional,
} from '@tanstack/router-core'

export interface UseMatchBaseOptions<
  TRouter extends AnyRouter,
  TFrom,
  TStrict extends boolean,
  TThrow extends boolean,
  TSelected,
> {
  select?: (
    match: MakeRouteMatch<TRouter['routeTree'], TFrom, TStrict>,
  ) => TSelected
  shouldThrow?: TThrow
}

export type UseMatchRoute<out TFrom> = <
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
>(
  opts?: UseMatchBaseOptions<TRouter, TFrom, true, true, TSelected>,
) => Solid.Accessor<UseMatchResult<TRouter, TFrom, true, TSelected>>

export type UseMatchOptions<
  TRouter extends AnyRouter,
  TFrom extends string | undefined,
  TStrict extends boolean,
  TThrow extends boolean,
  TSelected,
> = StrictOrFrom<TRouter, TFrom, TStrict> &
  UseMatchBaseOptions<TRouter, TFrom, TStrict, TThrow, TSelected>

export type UseMatchResult<
  TRouter extends AnyRouter,
  TFrom,
  TStrict extends boolean,
  TSelected,
> = unknown extends TSelected
  ? TStrict extends true
    ? MakeRouteMatch<TRouter['routeTree'], TFrom, TStrict>
    : MakeRouteMatchUnion<TRouter>
  : TSelected

export function useMatch<
  TRouter extends AnyRouter = RegisteredRouter,
  const TFrom extends string | undefined = undefined,
  TStrict extends boolean = true,
  TThrow extends boolean = true,
  TSelected = unknown,
>(
  opts: UseMatchOptions<
    TRouter,
    TFrom,
    TStrict,
    ThrowConstraint<TStrict, TThrow>,
    TSelected
  >,
): Solid.Accessor<
  ThrowOrOptional<UseMatchResult<TRouter, TFrom, TStrict, TSelected>, TThrow>
> {
  const router = useRouter<TRouter>()
  const nearestMatch = opts.from
    ? undefined
    : Solid.useContext(nearestMatchContext)

  const match = () => {
    if (opts.from) {
      return router.stores.getRouteMatchStore(opts.from).get()
    }

    return nearestMatch?.match()
  }

  Solid.createEffect(() => {
    if (match() !== undefined) {
      return
    }

    const hasPendingMatch = opts.from
      ? Boolean(router.stores.pendingRouteIds.get()[opts.from!])
      : (nearestMatch?.hasPending() ?? false)

    if (
      !hasPendingMatch &&
      !router.stores.isTransitioning.get() &&
      (opts.shouldThrow ?? true)
    ) {
      if (process.env.NODE_ENV !== 'production') {
        throw new Error(
          `Invariant failed: Could not find ${opts.from ? `an active match from "${opts.from}"` : 'a nearest match!'}`,
        )
      }

      invariant()
    }
  })

  return Solid.createMemo((prev: TSelected | undefined) => {
    const selectedMatch = match()

    if (selectedMatch === undefined) {
      const hasPendingMatch = opts.from
        ? Boolean(router.stores.pendingRouteIds.get()[opts.from!])
        : (nearestMatch?.hasPending() ?? false)

      if (
        prev !== undefined &&
        (hasPendingMatch || router.stores.isTransitioning.get())
      ) {
        return prev
      }

      return undefined
    }

    const res = opts.select ? opts.select(selectedMatch) : selectedMatch
    if (prev === undefined) return res as TSelected
    return replaceEqualDeep(prev, res) as TSelected
  }) as any
}
