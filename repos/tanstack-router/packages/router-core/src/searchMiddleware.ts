import { deepEqual, hasOwn } from './utils'
import type { NoInfer, PickOptional } from './utils'
import type {
  SearchMiddleware,
  SearchMiddlewareContext,
  SearchMiddlewareMeta,
} from './route'
import type { IsRequiredParams } from './link'

type SearchMiddlewareNextWithMeta<TSearchSchema> = (
  newSearch: TSearchSchema,
  collectMeta: true,
) => { search: TSearchSchema; meta: SearchMiddlewareMeta }

/**
 * Retain specified search params across navigations.
 *
 * If `keys` is `true`, retain all current params. Otherwise, copy only the
 * listed keys from the current search into the next search.
 *
 * @param keys `true` to retain all, or a list of keys to retain.
 * @returns A search middleware suitable for route `search.middlewares`.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/retainSearchParamsFunction
 */
export function retainSearchParams<TSearchSchema extends object>(
  keys: Array<keyof TSearchSchema> | true,
): SearchMiddleware<TSearchSchema> {
  return ({ search, next }) => {
    const { search: resultSearch, meta } = (
      next as unknown as SearchMiddlewareNextWithMeta<TSearchSchema>
    )(search, true)

    if (keys === true) {
      const copy = { ...search, ...resultSearch }
      const removed = meta.removed
      const explicit = meta.explicit
      for (const key of removed?.keys() || []) {
        if (
          (explicit && hasOwn.call(explicit, key)) ||
          deepEqual(search[key as keyof TSearchSchema], removed!.get(key))
        ) {
          delete copy[key as keyof TSearchSchema]
        }
      }
      for (const key of meta.removedAny || []) {
        delete copy[key as keyof TSearchSchema]
      }
      for (const key of meta.defaulted?.keys() || []) {
        if (
          key in search &&
          !meta.removedAny?.has(key) &&
          !(
            meta.removed?.has(key) &&
            ((explicit && hasOwn.call(explicit, key)) ||
              deepEqual(
                search[key as keyof TSearchSchema],
                meta.removed.get(key),
              ))
          )
        ) {
          copy[key as keyof TSearchSchema] = search[key as keyof TSearchSchema]
        }
      }
      return copy
    }

    const copy = { ...resultSearch }
    const explicit = meta.explicit
    // add missing keys from search to copy
    for (const key of keys) {
      const stringKey = key as string
      const removed =
        meta.removedAny?.has(stringKey) ||
        (meta.removed?.has(stringKey) &&
          ((explicit && hasOwn.call(explicit, stringKey)) ||
            deepEqual(search[key], meta.removed.get(stringKey))))
      if (
        !removed &&
        (!(key in copy) ||
          (key in search &&
            meta.defaulted?.has(stringKey) &&
            deepEqual(copy[key], meta.defaulted.get(stringKey))))
      ) {
        copy[key] = search[key]
      }
    }
    return copy
  }
}

/**
 * Remove optional or default-valued search params from navigations.
 *
 * - Pass `true` (only if there are no required search params) to strip all.
 * - Pass an array to always remove those optional keys.
 * - Pass an object of default values; keys equal (deeply) to the defaults are removed.
 *
 * @returns A search middleware suitable for route `search.middlewares`.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/stripSearchParamsFunction
 */
export function stripSearchParams<
  TSearchSchema,
  TOptionalProps = PickOptional<NoInfer<TSearchSchema>>,
  const TValues = Partial<NoInfer<TSearchSchema>> | Array<keyof TOptionalProps>,
  const TInput = IsRequiredParams<TSearchSchema> extends never
    ? TValues | true
    : TValues,
>(input: NoInfer<TInput>): SearchMiddleware<TSearchSchema> {
  return (({ search, next, meta }: SearchMiddlewareContext<TSearchSchema>) => {
    if (input === true) {
      Object.keys(search as object).forEach((key) => {
        if (meta) {
          ;(meta.removedAny ||= new Set()).add(key)
        }
      })
      return {}
    }
    const nextResult = next(search)
    const result = { ...nextResult } as Record<string, unknown>
    if (Array.isArray(input)) {
      input.forEach((key) => {
        delete result[key as string]
        if (meta) {
          ;(meta.removedAny ||= new Set()).add(key as string)
        }
      })
    } else {
      Object.entries(input as Record<string, unknown>).forEach(
        ([key, value]) => {
          if (deepEqual(result[key], value)) {
            delete result[key]
            if (meta) {
              ;(meta.removed ||= new Map()).set(key, value)
            }
          }
        },
      )
    }
    return result as any
  }) as SearchMiddleware<TSearchSchema>
}
