import { ApiError, type PageResult } from './types'

export function invalidResponse(endpoint: string): never {
  throw new ApiError(`Invalid API response: ${endpoint}`, {
    status: 502,
    code: 'INVALID_RESPONSE',
  })
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function requiredString(
  value: unknown,
  endpoint: string,
  allowEmpty = true
): string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    invalidResponse(endpoint)
  }
  return value
}

export function requiredNumber(value: unknown, endpoint: string): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) invalidResponse(endpoint)
  return parsed
}

export function requiredInteger(value: unknown, endpoint: string): number {
  const parsed = requiredNumber(value, endpoint)
  if (!Number.isSafeInteger(parsed)) invalidResponse(endpoint)
  return parsed
}

export function parsePage<T>(
  value: unknown,
  endpoint: string,
  parseItem: (item: unknown, endpoint: string) => T
): PageResult<T> {
  if (!isRecord(value) || !Array.isArray(value.items)) invalidResponse(endpoint)
  const page = requiredInteger(value.page, endpoint)
  const pageSize = requiredInteger(value.page_size ?? value.pageSize, endpoint)
  const total = requiredInteger(value.total, endpoint)
  if (page < 1 || pageSize < 1 || total < 0) invalidResponse(endpoint)
  return {
    items: value.items.map((item) => parseItem(item, endpoint)),
    total,
    page,
    pageSize,
  }
}

export function parseStringArray(value: unknown, endpoint: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    invalidResponse(endpoint)
  }
  return [...value]
}
