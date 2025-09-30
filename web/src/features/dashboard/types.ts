import type { TimeGranularity } from '@/lib/time'

/**
 * Dashboard 过滤器类型定义
 */
export interface DashboardFilters {
  start_timestamp?: Date
  end_timestamp?: Date
  time_granularity?: TimeGranularity
  username?: string
}

/**
 * 时间粒度选项
 */
export const TIME_GRANULARITY_OPTIONS: ReadonlyArray<{
  label: string
  value: TimeGranularity
}> = [
  { label: 'Hour', value: 'hour' },
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
] as const

/**
 * 快捷时间范围选项
 */
export const TIME_RANGE_PRESETS = [
  { label: '1D', days: 1 },
  { label: '7D', days: 7 },
  { label: '14D', days: 14 },
  { label: '29D', days: 29 },
] as const

/**
 * 空过滤器默认值
 */
export const EMPTY_DASHBOARD_FILTERS: DashboardFilters = {
  start_timestamp: undefined,
  end_timestamp: undefined,
  time_granularity: 'hour',
  username: '',
}
