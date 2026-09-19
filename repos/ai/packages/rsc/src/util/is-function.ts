/**
 * Checks if the given value is a function.
 *
 * @param {unknown} value - The value to check.
 * @returns {boolean} True if the value is a function, false otherwise.
 */
export const isFunction = (value: unknown): value is Function =>
  typeof value === 'function';
