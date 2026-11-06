import type {
  FromPathOption,
  NavigateOptions,
  PathParamOptions,
  SearchParamOptions,
  ToPathOption,
} from './link'
import type { RedirectOptions } from './redirect'
import type { RouteIds } from './routeInfo'
import type { AnyRouter, RegisteredRouter } from './router'
import type { UseParamsResult } from './useParams'
import type { UseSearchResult } from './useSearch'
import type { Constrain, ConstrainLiteral } from './utils'

export type ValidateFromPath<
  TRouter extends AnyRouter = RegisteredRouter,
  TFrom = string,
> = FromPathOption<TRouter, TFrom>

export type ValidateToPath<
  TRouter extends AnyRouter = RegisteredRouter,
  TTo extends string | undefined = undefined,
  TFrom extends string = string,
> = ToPathOption<TRouter, TFrom, TTo>

export type ValidateSearch<
  TRouter extends AnyRouter = RegisteredRouter,
  TTo extends string | undefined = undefined,
  TFrom extends string = string,
> = SearchParamOptions<TRouter, TFrom, TTo>

export type ValidateParams<
  TRouter extends AnyRouter = RegisteredRouter,
  TTo extends string | undefined = undefined,
  TFrom extends string = string,
> = PathParamOptions<TRouter, TFrom, TTo>

/**
 * @private
 */
export type InferFrom<
  TOptions,
  TDefaultFrom extends string = string,
> = TOptions extends {
  from: infer TFrom extends string
}
  ? TFrom
  : TDefaultFrom

/**
 * @private
 */
export type InferTo<TOptions> = TOptions extends {
  to: infer TTo extends string
}
  ? TTo
  : undefined

/**
 * @private
 */
export type InferMaskTo<TOptions> = TOptions extends {
  mask: { to: infer TTo extends string }
}
  ? TTo
  : ''

export type InferMaskFrom<TOptions> = TOptions extends {
  mask: { from: infer TFrom extends string }
}
  ? TFrom
  : string

export type ValidateNavigateOptions<
  TRouter extends AnyRouter = RegisteredRouter,
  TOptions = unknown,
  TDefaultFrom extends string = string,
> = Constrain<
  TOptions,
  NavigateOptions<
    TRouter,
    InferFrom<TOptions, TDefaultFrom>,
    InferTo<TOptions>,
    InferMaskFrom<TOptions>,
    InferMaskTo<TOptions>
  >
>

export type ValidateNavigateOptionsArray<
  TRouter extends AnyRouter = RegisteredRouter,
  TOptions extends ReadonlyArray<any> = ReadonlyArray<unknown>,
  TDefaultFrom extends string = string,
> = {
  [K in keyof TOptions]: ValidateNavigateOptions<
    TRouter,
    TOptions[K],
    TDefaultFrom
  >
}

export type ValidateRedirectOptions<
  TRouter extends AnyRouter = RegisteredRouter,
  TOptions = unknown,
  TDefaultFrom extends string = string,
> = Constrain<
  TOptions,
  RedirectOptions<
    TRouter,
    InferFrom<TOptions, TDefaultFrom>,
    InferTo<TOptions>,
    InferMaskFrom<TOptions>,
    InferMaskTo<TOptions>
  >
>

export type ValidateRedirectOptionsArray<
  TRouter extends AnyRouter = RegisteredRouter,
  TOptions extends ReadonlyArray<any> = ReadonlyArray<unknown>,
  TDefaultFrom extends string = string,
> = {
  [K in keyof TOptions]: ValidateRedirectOptions<
    TRouter,
    TOptions[K],
    TDefaultFrom
  >
}

export type ValidateId<
  TRouter extends AnyRouter = RegisteredRouter,
  TId extends string = string,
> = ConstrainLiteral<TId, RouteIds<TRouter['routeTree']>>

/**
 * @private
 */
export type InferStrict<TOptions> = TOptions extends {
  strict: infer TStrict extends boolean
}
  ? TStrict
  : true

/**
 * @private
 */
export type InferShouldThrow<TOptions> = TOptions extends {
  shouldThrow: infer TShouldThrow extends boolean
}
  ? TShouldThrow
  : true

/**
 * @private
 */
export type InferSelected<TOptions> = TOptions extends {
  select: (...args: Array<any>) => infer TSelected
}
  ? TSelected
  : unknown

export type ValidateUseSearchResult<
  TOptions,
  TRouter extends AnyRouter = RegisteredRouter,
> = UseSearchResult<
  TRouter,
  InferFrom<TOptions>,
  InferStrict<TOptions>,
  InferSelected<TOptions>
>

export type ValidateUseParamsResult<
  TOptions,
  TRouter extends AnyRouter = RegisteredRouter,
> = Constrain<
  TOptions,
  UseParamsResult<
    TRouter,
    InferFrom<TOptions>,
    InferStrict<TOptions>,
    InferSelected<TOptions>
  >
>
