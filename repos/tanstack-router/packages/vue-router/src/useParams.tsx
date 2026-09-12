import { useMatch } from './useMatch'
import type * as Vue from 'vue'
import type {
  AnyRouter,
  RegisteredRouter,
  ResolveUseParams,
  StrictOrFrom,
  ThrowConstraint,
  ThrowOrOptional,
  UseParamsResult,
} from '@tanstack/router-core'

export interface UseParamsBaseOptions<
  TRouter extends AnyRouter,
  TFrom,
  TStrict extends boolean,
  TThrow extends boolean,
  TSelected,
> {
  select?: (params: ResolveUseParams<TRouter, TFrom, TStrict>) => TSelected
  shouldThrow?: TThrow
}

export type UseParamsOptions<
  TRouter extends AnyRouter,
  TFrom extends string | undefined,
  TStrict extends boolean,
  TThrow extends boolean,
  TSelected,
> = StrictOrFrom<TRouter, TFrom, TStrict> &
  UseParamsBaseOptions<TRouter, TFrom, TStrict, TThrow, TSelected>

export type UseParamsRoute<out TFrom> = <
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
>(
  opts?: UseParamsBaseOptions<
    TRouter,
    TFrom,
    /* TStrict */ true,
    /* TThrow */ true,
    TSelected
  >,
) => Vue.Ref<UseParamsResult<TRouter, TFrom, true, TSelected>>

export function useParams<
  TRouter extends AnyRouter = RegisteredRouter,
  const TFrom extends string | undefined = undefined,
  TStrict extends boolean = true,
  TThrow extends boolean = true,
  TSelected = unknown,
>(
  opts: UseParamsOptions<
    TRouter,
    TFrom,
    TStrict,
    ThrowConstraint<TStrict, TThrow>,
    TSelected
  >,
): Vue.Ref<
  ThrowOrOptional<UseParamsResult<TRouter, TFrom, TStrict, TSelected>, TThrow>
> {
  return useMatch({
    from: opts.from!,
    strict: opts.strict,
    shouldThrow: opts.shouldThrow,
    select: (match) => {
      return opts.select ? opts.select(match.params) : match.params
    },
  }) as any
}
