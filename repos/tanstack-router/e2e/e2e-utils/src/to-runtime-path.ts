/**
 * Converts the given input string to a valid runtime path based on the environment configuration.
 * If the environment variable `VITE_APP_HISTORY` is set to 'hash', the input will be prefixed with `/#`.
 * Otherwise, the input will be returned as is.
 *
 * @param {string} input - The input string to be converted.
 * @returns {string} - The converted test URL value.
 * @example
 * toRuntimePath('/normal-page') // '/normal-page'
 * // or
 * process.env.VITE_APP_HISTORY = 'hash'
 * toRuntimePath('/normal-page') // '/#/normal-page'
 */
export function toRuntimePath(input: string) {
  const value = process.env.VITE_APP_HISTORY === 'hash' ? `/#${input}` : input
  return value
}
