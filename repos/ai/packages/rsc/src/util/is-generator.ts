export function isGenerator<T, TReturn, TNext>(
  value: unknown,
): value is Generator<T, TReturn, TNext> {
  return value != null && typeof value === 'object' && Symbol.iterator in value;
}
