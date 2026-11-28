/**
 * Resolves the runtime suffix based on the provided input or the environment variable `VITE_APP_HISTORY`.
 *
 * @param {string} [input] - Optional input to override the environment variable.
 * @returns {string} Returns 'hash' if the input or `VITE_APP_HISTORY` is set to 'hash', otherwise returns 'browser'.
 */
export function resolveRuntimeSuffix(input?: string): string {
  const value =
    input === 'hash' || process.env.VITE_APP_HISTORY === 'hash'
      ? 'hash'
      : 'browser'
  return value
}
