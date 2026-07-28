export type PerformanceTone = 'success' | 'warning' | 'danger' | 'neutral'

function isPositiveFinite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0
}

export function formatLogDuration(seconds: number | null | undefined): string {
  if (!isPositiveFinite(seconds)) return '—'

  if (seconds >= 60) {
    const rounded = Math.round(seconds)
    return `${Math.floor(rounded / 60)}m ${rounded % 60}s`
  }
  if (seconds < 10) return `${seconds.toFixed(2)}s`
  return `${seconds.toFixed(1)}s`
}

export function formatLogTps(tps: number | null | undefined): string {
  if (!isPositiveFinite(tps)) return '— t/s'
  return `${Math.round(tps)} t/s`
}

export function getFirstTokenTone(
  seconds: number | null | undefined
): PerformanceTone {
  if (!isPositiveFinite(seconds)) return 'neutral'
  if (seconds < 5) return 'success'
  if (seconds < 10) return 'warning'
  return 'danger'
}

export function getDurationTone(
  seconds: number,
  completionTokens: number,
  tps: number
): PerformanceTone {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'neutral'

  if (completionTokens >= 100 && Number.isFinite(tps) && tps > 0) {
    if (tps >= 30) return 'success'
    if (tps >= 15) return 'warning'
    return 'danger'
  }

  if (seconds < 10) return 'success'
  if (seconds < 30) return 'warning'
  return 'danger'
}
