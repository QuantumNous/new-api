/**
 * Filters `null` and `undefined` values out of a list of values.
 *
 * @param values - The values to filter.
 * @returns A new array containing only non-nullish values.
 */
export function filterNullable<T>(
  ...values: Array<T | undefined | null>
): Array<T> {
  return values.filter((value): value is NonNullable<T> => value != null);
}
