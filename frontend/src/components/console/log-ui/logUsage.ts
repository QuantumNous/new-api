import type { LogItem } from '@/types/console'

export interface LogUsageSummary {
  available: boolean
  promptTokens: number
  completionTokens: number
  cacheReadTokens: number | null
  cacheWriteTokens: number | null
  cacheTtl: string | null
  totalTokens: number
  cacheHitRate: number | null
}

function normalizeTokenCount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null
  return Math.round(value)
}

function requestTokenCount(value: number): number {
  return normalizeTokenCount(value) ?? 0
}

export function getLogUsageSummary(log: LogItem): LogUsageSummary {
  if (log.request_mode === null) {
    return {
      available: false,
      promptTokens: 0,
      completionTokens: 0,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      cacheTtl: null,
      totalTokens: 0,
      cacheHitRate: null,
    }
  }

  const promptTokens = requestTokenCount(log.prompt_tokens)
  const completionTokens = requestTokenCount(log.completion_tokens)
  const cacheReadTokens = normalizeTokenCount(log.cache_read_tokens)
  const cacheWriteTokens = normalizeTokenCount(log.cache_write_tokens)
  const totalTokens =
    promptTokens +
    completionTokens +
    (cacheReadTokens ?? 0) +
    (cacheWriteTokens ?? 0)
  const cacheTtl = log.cache_ttl?.trim() || null

  return {
    available: true,
    promptTokens,
    completionTokens,
    cacheReadTokens,
    cacheWriteTokens,
    cacheTtl,
    totalTokens,
    cacheHitRate:
      cacheReadTokens === null || totalTokens === 0
        ? null
        : (cacheReadTokens / totalTokens) * 100,
  }
}

export function formatLogCacheHitRate(value: number | null): string {
  return value === null || !Number.isFinite(value)
    ? '—'
    : `${value.toFixed(2)}%`
}
