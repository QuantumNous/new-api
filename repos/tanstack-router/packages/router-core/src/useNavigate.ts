import type { NavigateOptions } from './link'
import type { RegisteredRouter } from './router'

export type UseNavigateResult<TDefaultFrom extends string> = <
  TRouter extends RegisteredRouter,
  TTo extends string | undefined,
  TFrom extends string = TDefaultFrom,
  TMaskFrom extends string = TFrom,
  TMaskTo extends string = '',
>({
  from,
  ...rest
}: NavigateOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>) => Promise<void>
