/**
 * Type-guard for Node.js `Buffer` instances.
 *
 * Uses optional chaining on `globalThis.Buffer` so it returns `false` in
 * runtimes where `Buffer` is not available (e.g. CloudFlare Workers).
 */
export function isBuffer(value: unknown): value is Buffer {
  return globalThis.Buffer?.isBuffer(value) ?? false;
}
