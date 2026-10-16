import { useMatch } from './useMatch'
import type {
  StructuralSharingOption,
  ValidateSelected,
} from './structuralSharing'
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
  TStructuralSharing,
> {
  select?: (
    state: ResolveUseSearch<TRouter, TFrom, TStrict>,
  ) => ValidateSelected<TRouter, TSelected, TStructuralSharing>
  shouldThrow?: TThrow
}

export type UseSearchOptions<
  TRouter extends AnyRouter,
  TFrom,
  TStrict extends boolean,
  TThrow extends boolean,
  TSelected,
  TStructuralSharing,
> = StrictOrFrom<TRouter, TFrom, TStrict> &
  UseSearchBaseOptions<
    TRouter,
    TFrom,
    TStrict,
    TThrow,
    TSelected,
    TStructuralSharing
  > &
  StructuralSharingOption<TRouter, TSelected, TStructuralSharing>

export type UseSearchRoute<out TFrom> = <
  TRouter extends AnyRouter = RegisteredRouter,
  TSelected = unknown,
  TStructuralSharing extends boolean = boolean,
>(
  opts?: UseSearchBaseOptions<
    TRouter,
    TFrom,
    /* TStrict */ true,
    /* TThrow */ true,
    TSelected,
    TStructuralSharing
  > &
    StructuralSharingOption<TRouter, TSelected, TStructuralSharing>,
) => UseSearchResult<TRouter, TFrom, true, TSelected>

/**
 * Read and select the current route's search parameters with type-safety.
 *
 * Options:
 * - `from`/`strict`: Control which route's search is read and how strictly it's typed
 * - `select`: Map the search object to a derived value for render optimization
 * - `structuralSharing`: Enable structural sharing for stable references
 * - `shouldThrow`: Throw when the route is not found (strict contexts)
 *
 * @returns The search object (or selected value) for the matched route.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/useSearchHook
 */
export function useSearch<
  TRouter extends AnyRouter = RegisteredRouter,
  const TFrom extends string | undefined = undefined,
  TStrict extends boolean = true,
  TThrow extends boolean = true,
  TSelected = unknown,
  TStructuralSharing extends boolean = boolean,
>(
  opts: UseSearchOptions<
    TRouter,
    TFrom,
    TStrict,
    ThrowConstraint<TStrict, TThrow>,
    TSelected,
    TStructuralSharing
  >,
): ThrowOrOptional<
  UseSearchResult<TRouter, TFrom, TStrict, TSelected>,
  TThrow
> {
  return useMatch({
    from: opts.from!,
    strict: opts.strict,
    shouldThrow: opts.shouldThrow,
    structuralSharing: opts.structuralSharing,
    select: (match) => {
      return opts.select ? opts.select(match.search) : match.search
    },
  }) as any
}
