export const isObjectRecord = (
  data: unknown
): data is Record<string, unknown> =>
  typeof data === 'object' && data !== null && !Array.isArray(data)

export const isArray = (data: unknown): data is unknown[] => Array.isArray(data)

export const isStringArray = (data: unknown): data is string[] =>
  Array.isArray(data) && data.every((item) => typeof item === 'string')

export const isNumberArray = (data: unknown): data is number[] =>
  Array.isArray(data) && data.every((item) => typeof item === 'number')

export const isObjectArray = (
  data: unknown
): data is Record<string, unknown>[] =>
  Array.isArray(data) && data.every((item) => isObjectRecord(item))

export function createObjectValidator<T extends Record<string, unknown>>(
  requiredKeys: (keyof T)[]
): (data: unknown) => data is T {
  return (data): data is T => {
    if (!isObjectRecord(data)) return false
    return requiredKeys.every((key) => key in data)
  }
}

export function createArrayValidator<T>(
  itemValidator: (item: unknown) => item is T
): (data: unknown) => data is T[] {
  return (data): data is T[] => {
    if (!Array.isArray(data)) return false
    return data.every(itemValidator)
  }
}
