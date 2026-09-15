/**
 * Reads a property by an untrusted key, ignoring inherited prototype members.
 *
 * Tool sets, tool contexts, and similar lookup objects are indexed by names
 * that can come from model output or client-supplied message history. Plain
 * bracket access (`obj[name]`) resolves names such as `constructor`,
 * `toString`, or `__proto__` to values on `Object.prototype`, which would slip
 * past the `== null` / `!value` guards that treat an unknown name as "not
 * present". This helper returns `undefined` unless `key` is an own property.
 */
export function getOwn<T extends object>(
  obj: T | undefined | null,
  key: string,
): T[keyof T] | undefined {
  return obj != null && Object.hasOwn(obj, key)
    ? obj[key as keyof T]
    : undefined;
}
