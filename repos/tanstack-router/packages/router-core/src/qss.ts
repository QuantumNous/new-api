/**
 * Program is a reimplementation of the `qss` package:
 * Copyright (c) Luke Edwards luke.edwards05@gmail.com, MIT License
 * https://github.com/lukeed/qss/blob/master/license.md
 *
 * This reimplementation uses modern browser APIs
 * (namely URLSearchParams) and TypeScript while still
 * maintaining the original functionality and interface.
 *
 * Update: this implementation has also been mangled to
 * fit exactly our use-case (single value per key in encoding).
 */

/**
 * Encodes an object into a query string.
 * @param obj - The object to encode into a query string.
 * @param stringify - An optional custom stringify function.
 * @returns The encoded query string.
 * @example
 * ```
 * // Example input: encode({ token: 'foo', key: 'value' })
 * // Expected output: "token=foo&key=value"
 * ```
 */
export function encode(
  obj: Record<string, any>,
  stringify: (value: any) => string = String,
): string {
  const result = new URLSearchParams()

  for (const key in obj) {
    const val = obj[key]
    if (val !== undefined) {
      result.set(key, stringify(val))
    }
  }

  return result.toString()
}

/**
 * Converts a string value to its appropriate type (string, number, boolean).
 * @param mix - The string value to convert.
 * @returns The converted value.
 * @example
 * // Example input: toValue("123")
 * // Expected output: 123
 */
function toValue(str: unknown) {
  if (!str) return ''

  if (str === 'false') return false
  if (str === 'true') return true
  return +str * 0 === 0 && +str + '' === str ? +str : str
}
/**
 * Decodes a query string into an object.
 * @param str - The query string to decode.
 * @returns The decoded key-value pairs in an object format.
 * @example
 * // Example input: decode("token=foo&key=value")
 * // Expected output: { "token": "foo", "key": "value" }
 */
export function decode(str: any): any {
  const searchParams = new URLSearchParams(str)

  const result: Record<string, unknown> = Object.create(null)

  for (const [key, value] of searchParams.entries()) {
    const previousValue = result[key]
    if (previousValue == null) {
      result[key] = toValue(value)
    } else if (Array.isArray(previousValue)) {
      previousValue.push(toValue(value))
    } else {
      result[key] = [previousValue, toValue(value)]
    }
  }

  return result
}
