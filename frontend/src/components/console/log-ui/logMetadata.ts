import type { LogItem, LogOther } from '@/types/console'

export type LogReasoningEffort = 'low' | 'medium' | 'high' | 'xHigh' | 'max'

export interface LogMetadata {
  reasoningEffort: string | null
  fastMode: boolean
}

const KNOWN_EFFORTS: Record<string, LogReasoningEffort> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xHigh',
  max: 'max',
}

function parseOther(other: LogOther | undefined): Record<string, unknown> {
  if (!other) return {}
  if (typeof other === 'object' && !Array.isArray(other)) return other
  if (typeof other !== 'string') return {}

  try {
    const parsed: unknown = JSON.parse(other)
    return parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function firstValue(
  log: LogItem,
  other: Record<string, unknown>,
  key: keyof Pick<
    LogItem,
    'reasoning_effort' | 'fast_mode' | 'service_tier' | 'speed'
  >
): unknown {
  const direct = log[key]
  return direct !== undefined && direct !== null ? direct : other[key]
}

function normalizeReasoningEffort(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  return KNOWN_EFFORTS[raw.toLowerCase()] ?? raw
}

function readExplicitFastMode(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function isFastLabel(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === 'fast'
}

export function getLogMetadata(log: LogItem): LogMetadata {
  const other = parseOther(log.other)
  const explicitFast = readExplicitFastMode(firstValue(log, other, 'fast_mode'))
  const fastMode =
    explicitFast ??
    (isFastLabel(firstValue(log, other, 'service_tier')) ||
      isFastLabel(firstValue(log, other, 'speed')))

  return {
    reasoningEffort: normalizeReasoningEffort(
      firstValue(log, other, 'reasoning_effort')
    ),
    fastMode,
  }
}

export function formatReasoningEffort(value: string | null): string {
  return value ?? '—'
}
