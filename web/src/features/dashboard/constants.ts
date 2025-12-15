/**
 * Dashboard filter settings
 */
export const DEFAULT_TIME_RANGE_DAYS = 7

/**
 * Standardized chart height classes for consistent sizing
 */
export const CHART_HEIGHTS = {
  /** Standard charts (bar, area, line) */
  default: 'h-[28rem] sm:h-96',
  /** Charts with external labels (pie/donut) */
  withLabels: 'h-[32rem] sm:h-96',
} as const
