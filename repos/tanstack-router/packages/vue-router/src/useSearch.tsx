import { useMatch } from './useMatch'
import type * as Vue from 'vue'
import type {
  AnyRouter,
  RegisteredRouter,
  ResolveUseSearch,
  StrictOrFrom,
  ThrowConstraint,
  ThrowOrOptional,
  UseSearchResult,
} from '@tanstack/router-core'

export interface UseSearchBaseOptions<
  TRouter extends AnyRouter,
  TFrom,
  TStrict extends boolean,
  TThrow extends boolean,
  TSelected,
> {
  select?: (state: ResolveUseSearch<TRouter, TFrom, TStrict>) => TSelected
  shouldThrow?: TThrow
}

export type UseSearchOptions<
  TRouter extends AnyRouter,
  TFrom,
  TStrict extends boolean,
  TThrow extends boolean,
  TSelected,
> = StrictOrFrom<TRouter, TFrom, TStrict> &
  UseSearchBaseOptions<TRouter, TFrom, TStrict, TThrow, TSelected>

export type UseSearchRoute<out TFrom> = <
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
>(
  opts?: UseSearchBaseOptions<
    TRouter,
    TFrom,
    /* TStrict */ true,
    /* TThrow */ true,
    TSelected
  >,
) => Vue.Ref<UseSearchResult<TRouter, TFrom, true, TSelected>>

export function useSearch<
  TRouter extends AnyRouter = RegisteredRouter,
  const TFrom extends string | undefined = undefined,
  TStrict extends boolean = true,
  TThrow extends boolean = true,
  TSelected = unknown,
>(
  opts: UseSearchOptions<
    TRouter,
    TFrom,
    TStrict,
    ThrowConstraint<TStrict, TThrow>,
    TSelected
  >,
): Vue.Ref<
  ThrowOrOptional<UseSearchResult<TRouter, TFrom, TStrict, TSelected>, TThrow>
> {
  return useMatch({
    from: opts.from!,
    strict: opts.strict,
    shouldThrow: opts.shouldThrow,
    select: (match) => {
      return opts.select ? opts.select(match.search) : match.search
    },
  }) as any
}
