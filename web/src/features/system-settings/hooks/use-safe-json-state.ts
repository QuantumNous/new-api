import { useMemo } from 'react'
import {
  safeJsonParse,
  safeJsonParseWithValidation,
} from '../utils/json-parser'
import type {
  SafeJsonParseOptions,
  SafeJsonParseWithValidationOptions,
} from '../utils/json-parser'

export function useSafeJsonParse<T>(
  value: string | undefined | null,
  options: Required<Pick<SafeJsonParseOptions<T>, 'fallback' | 'context'>> &
    Omit<SafeJsonParseOptions<T>, 'fallback' | 'context'>
): T {
  return useMemo(
    () =>
      safeJsonParse(value, {
        fallback: options.fallback,
        context: options.context,
        silent: options.silent,
      }),
    [value, options.fallback, options.context, options.silent]
  )
}

export function useSafeJsonParseWithValidation<T>(
  value: string | undefined | null,
  options: SafeJsonParseWithValidationOptions<T>
): T {
  return useMemo(
    () => safeJsonParseWithValidation(value, options),
    [
      value,
      options.fallback,
      options.validator,
      options.validatorMessage,
      options.context,
    ]
  )
}
