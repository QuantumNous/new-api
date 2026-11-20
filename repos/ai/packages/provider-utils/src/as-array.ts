/**
 * A value that can be provided either as a single item, an array of items,
 * or be left undefined.
 */
export type Arrayable<T> = T | T[] | undefined;

/**
 * Normalizes a possibly undefined or non-array value into an array.
 */
export function asArray<T>(value: Arrayable<T>): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}
