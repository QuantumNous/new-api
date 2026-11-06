import { useMatch } from './useMatch'
import type * as Vue from 'vue'
import type {
  AnyRouter,
  RegisteredRouter,
  ResolveUseLoaderDeps,
  StrictOrFrom,
  UseLoaderDepsResult,
} from '@tanstack/router-core'

export interface UseLoaderDepsBaseOptions<
  TRouter extends AnyRouter,
  TFrom,
  TSelected,
> {
  select?: (deps: ResolveUseLoaderDeps<TRouter, TFrom>) => TSelected
}

export type UseLoaderDepsOptions<
  TRouter extends AnyRouter,
  TFrom extends string | undefined,
  TSelected,
> = StrictOrFrom<TRouter, TFrom> &
  UseLoaderDepsBaseOptions<TRouter, TFrom, TSelected>

export type UseLoaderDepsRoute<out TId> = <
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
>(
  opts?: UseLoaderDepsBaseOptions<TRouter, TId, TSelected>,
) => Vue.Ref<UseLoaderDepsResult<TRouter, TId, TSelected>>

export function useLoaderDeps<
  TRouter extends AnyRouter = RegisteredRouter,
  const TFrom extends string | undefined = undefined,
  TSelected = unknown,
>(
  opts: UseLoaderDepsOptions<TRouter, TFrom, TSelected>,
): Vue.Ref<UseLoaderDepsResult<TRouter, TFrom, TSelected>> {
  const { select, ...rest } = opts
  return useMatch({
    ...rest,
    select: (match) => {
      return select ? select(match.loaderDeps) : match.loaderDeps
    },
  }) as Vue.Ref<UseLoaderDepsResult<TRouter, TFrom, TSelected>>
}
