import { useQuery } from '@tanstack/react-query'
import { getSystemOptions } from '../api'

export function useSystemOptions() {
  return useQuery({
    queryKey: ['system-options'],
    queryFn: getSystemOptions,
    staleTime: 5 * 60 * 1000,
  })
}

type ParseResult<T> =
  | { success: true; value: T }
  | { success: false; error: string; fallback: T }

function parseOptionValueSafe<T>(
  value: string,
  defaultValue: T
): ParseResult<T> {
  if (typeof defaultValue === 'boolean') {
    return {
      success: true,
      value: (value === 'true' || value === '1') as T,
    }
  }

  if (typeof defaultValue === 'number') {
    const trimmed = value.trim()
    if (trimmed === '') {
      return {
        success: false,
        error: 'Empty string for number field',
        fallback: defaultValue,
      }
    }
    const parsed = Number(trimmed)
    if (Number.isNaN(parsed)) {
      return {
        success: false,
        error: `Invalid number: "${value}"`,
        fallback: defaultValue,
      }
    }
    return { success: true, value: parsed as T }
  }

  if (Array.isArray(defaultValue)) {
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) {
        return {
          success: false,
          error: 'Expected array but got non-array JSON',
          fallback: defaultValue,
        }
      }

      if (defaultValue.length > 0) {
        const expectedType = typeof defaultValue[0]
        const invalidElement = parsed.find((el) => typeof el !== expectedType)
        if (invalidElement !== undefined) {
          return {
            success: false,
            error: `Array element type mismatch: expected ${expectedType}, got ${typeof invalidElement}`,
            fallback: defaultValue,
          }
        }
      }

      return { success: true, value: parsed as T }
    } catch (e) {
      return {
        success: false,
        error: `JSON parse failed: ${e instanceof Error ? e.message : String(e)}`,
        fallback: defaultValue,
      }
    }
  }

  return { success: true, value: value as T }
}

export function getOptionValue<
  T extends Record<string, string | number | boolean | unknown[]>,
>(options: Array<{ key: string; value: string }> | undefined, defaults: T): T {
  if (!options) return defaults

  const result = { ...defaults }
  const errors: Array<{ key: string; error: string }> = []

  options.forEach((option) => {
    if (option.key in defaults) {
      const parseResult = parseOptionValueSafe(
        option.value,
        defaults[option.key as keyof T]
      )

      if (parseResult.success) {
        result[option.key as keyof T] = parseResult.value as T[keyof T]
      } else {
        result[option.key as keyof T] = parseResult.fallback as T[keyof T]
        errors.push({ key: option.key, error: parseResult.error })
      }
    }
  })

  if (errors.length > 0 && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn('[System Options] Parsing errors detected:', errors)
  }

  return result
}
