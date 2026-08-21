/**
 * Returns `true` when running in a browser.
 *
 * Detection keys on the presence of a global `window`, matching the browser
 * check used elsewhere in this package (see `getRuntimeEnvironmentUserAgent`)
 * so the SDK has a single, consistent definition of "browser". Server runtimes
 * (Node.js, Deno, Bun, edge/workers) do not define `window`.
 */
export function isBrowserRuntime(
  globalThisAny: any = globalThis as any,
): boolean {
  return globalThisAny.window != null;
}
