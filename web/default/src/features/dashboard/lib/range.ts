// Dashboard time-range policy, mirroring common/dashboard_range.go.
//
// The server accepts a span of up to DASHBOARD_MAX_RANGE_DAYS and internally
// splits anything longer than DASHBOARD_MAX_SEGMENT_DAYS into bounded segments
// that it merges again over Asia/Shanghai buckets. The client enforces the same
// total bound so an impossible selection fails immediately with an actionable
// message instead of a round trip that can only be rejected.
export const DASHBOARD_MAX_RANGE_DAYS = 90
export const DASHBOARD_MAX_SEGMENT_DAYS = 31
export const DASHBOARD_MAX_RANGE_SECONDS =
  DASHBOARD_MAX_RANGE_DAYS * 24 * 60 * 60

export const DASHBOARD_RANGE_INVALID = 'dashboard_range_invalid'
export const DASHBOARD_RANGE_INVERTED = 'dashboard_range_inverted'
export const DASHBOARD_RANGE_TOO_LARGE = 'dashboard_range_too_large'

export type DashboardRangeErrorCode =
  | typeof DASHBOARD_RANGE_INVALID
  | typeof DASHBOARD_RANGE_INVERTED
  | typeof DASHBOARD_RANGE_TOO_LARGE

/**
 * Returns an error code for an unusable range, or null when it can be served.
 * Accepts the already-computed Unix-second bounds.
 */
export function validateDashboardRange(
  start: number,
  end: number
): DashboardRangeErrorCode | null {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return DASHBOARD_RANGE_INVALID
  }
  if (start < 0 || end < 0) return DASHBOARD_RANGE_INVALID
  if (end < start) return DASHBOARD_RANGE_INVERTED
  if (end - start > DASHBOARD_MAX_RANGE_SECONDS) {
    return DASHBOARD_RANGE_TOO_LARGE
  }
  return null
}

export function describeDashboardRangeError(
  code: DashboardRangeErrorCode
): string {
  switch (code) {
    case DASHBOARD_RANGE_TOO_LARGE:
      return `查询时间跨度不能超过 ${DASHBOARD_MAX_RANGE_DAYS} 天`
    case DASHBOARD_RANGE_INVERTED:
      return '结束时间不能早于开始时间'
    default:
      return '请选择有效的分析时间范围'
  }
}

/**
 * Error thrown by the quota-series helpers so callers can distinguish a client
 * side range rejection from a transport failure.
 */
export class DashboardRangeError extends Error {
  readonly code: DashboardRangeErrorCode

  constructor(code: DashboardRangeErrorCode) {
    super(describeDashboardRangeError(code))
    this.name = 'DashboardRangeError'
    this.code = code
  }
}

export function assertDashboardRange(start: number, end: number): void {
  const code = validateDashboardRange(start, end)
  if (code) throw new DashboardRangeError(code)
}
