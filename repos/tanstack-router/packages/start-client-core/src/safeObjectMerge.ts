function isSafeKey(key: string): boolean {
  return key !== '__proto__' && key !== 'constructor' && key !== 'prototype'
}

/**
 * Merge target and source into a new null-proto object, filtering dangerous keys.
 */
export function safeObjectMerge<T extends Record<string, unknown>>(
  target: T | undefined,
  source: Record<string, unknown> | null | undefined,
): T {
  const result = Object.create(null) as T
  if (target) {
    for (const key of Object.keys(target)) {
      if (isSafeKey(key)) result[key as keyof T] = target[key] as T[keyof T]
    }
  }
  if (source && typeof source === 'object') {
    for (const key of Object.keys(source)) {
      if (isSafeKey(key)) result[key as keyof T] = source[key] as T[keyof T]
    }
  }
  return result
}

/**
 * Create a null-prototype object, optionally copying from source.
 */
export function createNullProtoObject<T extends object>(
  source?: T,
): { [K in keyof T]: T[K] } {
  if (!source) return Object.create(null)
  const obj = Object.create(null)
  for (const key of Object.keys(source)) {
    if (isSafeKey(key)) obj[key] = (source as Record<string, unknown>)[key]
  }
  return obj
}
