/**
 * Creates a string-keyed map without an object prototype.
 *
 * Use this for lookup tables keyed by IDs or names that may come from outside
 * the SDK, such as streamed chunk IDs or tool call IDs. Unlike `{}`, these maps
 * do not inherit `__proto__`, `constructor`, or other Object prototype members,
 * so a missing untrusted key cannot resolve to a shared prototype object.
 */
export function createIdMap<T>(): Record<string, T> {
  return Object.create(null);
}
