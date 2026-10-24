'use client'

import * as React from 'react'
import { useStore } from '@tanstack/react-store'
import { invariant, replaceEqualDeep } from '@tanstack/router-core'
import { isServer } from '@tanstack/router-core/isServer'
import { dummyMatchContext, matchContext } from './matchContext'
import { useRouter } from './useRouter'
import type {
  StructuralSharingOption,
  ValidateSelected,
} from './structuralSharing'
import type {
  AnyRouter,
  MakeRouteMatch,
  MakeRouteMatchUnion,
  RegisteredRouter,
  StrictOrFrom,
  ThrowConstraint,
  ThrowOrOptional,
} from '@tanstack/router-core'

const dummyStore = {
  get() {},
  subscribe() {
    return { unsubscribe() {} }
  },
} as any

export function useStructuralSharing<
  TRouter extends AnyRouter,
  TSelected,
  TStructuralSharing extends boolean,
  TStoreSlice,
  TSelectSlice = TStoreSlice,
>(
  opts:
    | {
        select?: (
          slice: TSelectSlice,
        ) => ValidateSelected<TRouter, TSelected, TStructuralSharing>
        structuralSharing?: boolean
      }
    | undefined,
  router: TRouter,
): (
  slice: TStoreSlice,
) => ValidateSelected<TRouter, TSelected, TStructuralSharing> {
  const previousResult =
    // @ts-expect-error -- init to undefined, but without writing `undefined` to shave bytes
    React.useRef<ValidateSelected<TRouter, TSelected, TStructuralSharing>>()

  return (slice) => {
    const selected = opts?.select
      ? opts.select(slice as unknown as TSelectSlice)
      : (slice as ValidateSelected<TRouter, TSelected, TStructuralSharing>)

    if (opts?.structuralSharing ?? router.options.defaultStructuralSharing) {
      return (previousResult.current = replaceEqualDeep(
        previousResult.current,
        selected,
      ))
    }

    return selected
  }
}

export interface UseMatchBaseOptions<
  TRouter extends AnyRouter,
  TFrom,
  TStrict extends boolean,
  TThrow extends boolean,
  TSelected,
  TStructuralSharing extends boolean,
> {
  select?: (
    match: MakeRouteMatch<TRouter['routeTree'], TFrom, TStrict>,
  ) => ValidateSelected<TRouter, TSelected, TStructuralSharing>
  shouldThrow?: TThrow
}

export type UseMatchRoute<out TFrom> = <
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
  TStructuralSharing extends boolean = boolean,
>(
  opts?: UseMatchBaseOptions<
    TRouter,
    TFrom,
    true,
    true,
    TSelected,
    TStructuralSharing
  > &
    StructuralSharingOption<TRouter, TSelected, TStructuralSharing>,
) => UseMatchResult<TRouter, TFrom, true, TSelected>

export type UseMatchOptions<
  TRouter extends AnyRouter,
  TFrom extends string | undefined,
  TStrict extends boolean,
  TThrow extends boolean,
  TSelected,
  TStructuralSharing extends boolean,
> = StrictOrFrom<TRouter, TFrom, TStrict> &
  UseMatchBaseOptions<
    TRouter,
    TFrom,
    TStrict,
    TThrow,
    TSelected,
    TStructuralSharing
  > &
  StructuralSharingOption<TRouter, TSelected, TStructuralSharing>

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

/**
 * Read and select the nearest or targeted route match.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/useMatchHook
 */
export function useMatch<
  TRouter extends AnyRouter = RegisteredRouter,
  const TFrom extends string | undefined = undefined,
  TStrict extends boolean = true,
  TThrow extends boolean = true,
  TSelected = unknown,
  TStructuralSharing extends boolean = boolean,
>(
  opts: UseMatchOptions<
    TRouter,
    TFrom,
    TStrict,
    ThrowConstraint<TStrict, TThrow>,
    TSelected,
    TStructuralSharing
  >,
): ThrowOrOptional<UseMatchResult<TRouter, TFrom, TStrict, TSelected>, TThrow> {
  const router = useRouter<TRouter>()
  const nearestMatchId = React.useContext(
    opts.from ? dummyMatchContext : matchContext,
  )

  const matchStore = opts.from
    ? router.stores.getRouteMatchStore(opts.from)
    : router.stores.matchStores.get(nearestMatchId!)

  if (isServer ?? router.isServer) {
    const match = matchStore?.get()
    if (!match) {
      if (opts.shouldThrow ?? true) {
        if (process.env.NODE_ENV !== 'production') {
          throw new Error(
            `Invariant failed: Could not find ${opts.from ? `an active match from "${opts.from}"` : 'a nearest match!'}`,
          )
        }

        invariant()
      }

      return undefined as any
    }

    return (opts.select ? opts.select(match as any) : match) as any
  }

  const selector =
    // eslint-disable-next-line react-hooks/rules-of-hooks -- condition is static
    useStructuralSharing(opts, router)

  // eslint-disable-next-line react-hooks/rules-of-hooks -- condition is static
  const matchSelection = useStore(matchStore ?? dummyStore, (match) =>
    match ? selector(match as any) : dummyStore,
  )

  if (matchSelection !== dummyStore) {
    return matchSelection
  }

  if (opts.shouldThrow ?? true) {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(
        `Invariant failed: Could not find ${opts.from ? `an active match from "${opts.from}"` : 'a nearest match!'}`,
      )
    }

    invariant()
  }

  return undefined as any
}
