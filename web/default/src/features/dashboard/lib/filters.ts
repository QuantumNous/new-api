import type { TimeGranularity } from '@/lib/time'
import {
  DEFAULT_TIME_GRANULARITY,
  TIME_GRANULARITY_STORAGE_KEY,
  TIME_RANGE_BY_GRANULARITY,
} from '@/features/dashboard/constants'

export function cleanFilters<T extends Record<string, unknown>>(
  filters: T
): Partial<T> {
  const cleaned: Partial<T> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) cleaned[key as keyof T] = trimmed as T[keyof T]
      continue
    }
    cleaned[key as keyof T] = value as T[keyof T]
  }
  return cleaned
}

export function getSavedGranularity(
  override?: TimeGranularity
): TimeGranularity {
  if (override) return override
  if (typeof window === 'undefined') return DEFAULT_TIME_GRANULARITY
  const saved = localStorage.getItem(TIME_GRANULARITY_STORAGE_KEY)
  if (saved === 'hour' || saved === 'day' || saved === 'week') return saved
  return DEFAULT_TIME_GRANULARITY
}

export function saveGranularity(granularity: TimeGranularity): void {
  localStorage.setItem(TIME_GRANULARITY_STORAGE_KEY, granularity)
}

export function getDefaultDays(granularity?: TimeGranularity): number {
  return TIME_RANGE_BY_GRANULARITY[getSavedGranularity(granularity)]
}

export function buildQueryParams(
  timeRange: { start_timestamp: number; end_timestamp: number },
  filters?: { time_granularity?: TimeGranularity; username?: string }
): {
  start_timestamp: number
  end_timestamp: number
  default_time: string
  username?: string
} {
  return {
    ...timeRange,
    default_time: getSavedGranularity(filters?.time_granularity),
    ...(filters?.username && { username: filters.username }),
  }
}
