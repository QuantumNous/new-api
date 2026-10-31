import type { SSROption } from './router'
import type { AnySerializationAdapter } from './ssr/serializer/transformer'

export interface RouterConfigOptions<
  in out TSerializationAdapters,
  in out TDefaultSsr,
> {
  serializationAdapters?: TSerializationAdapters
  defaultSsr?: TDefaultSsr
}

export interface RouterConfig<
  in out TSerializationAdapters,
  in out TDefaultSsr,
> {
  '~types': RouterConfigTypes<TSerializationAdapters, TDefaultSsr>
  serializationAdapters: TSerializationAdapters
  defaultSsr: TDefaultSsr | undefined
}

export interface RouterConfigTypes<
  in out TSerializationAdapters,
  in out TDefaultSsr,
> {
  serializationAdapters: TSerializationAdapters
  defaultSsr: TDefaultSsr
}

export const createRouterConfig = <
  const TSerializationAdapters extends ReadonlyArray<AnySerializationAdapter> =
    [],
  TDefaultSsr extends SSROption = SSROption,
>(
  options: RouterConfigOptions<TSerializationAdapters, TDefaultSsr>,
): RouterConfig<TSerializationAdapters, TDefaultSsr> => {
  return {
    serializationAdapters: options.serializationAdapters,
    defaultSsr: options.defaultSsr,
  } as RouterConfig<TSerializationAdapters, TDefaultSsr>
}

export type AnyRouterConfig = RouterConfig<any, any>
