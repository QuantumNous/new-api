import type { DashboardChartPreferences, DashboardFilters } from './types'

export const TIME_GRANULARITY_STORAGE_KEY = 'data_export_default_time'
export const DASHBOARD_CHART_PREFERENCES_STORAGE_KEY =
  'dashboard_models_chart_preferences'
export const DEFAULT_TIME_GRANULARITY = 'hour' as const
export const MAX_CHART_TREND_POINTS = 7

export const DEFAULT_DASHBOARD_CHART_PREFERENCES: DashboardChartPreferences = {
  consumptionDistributionChart: 'bar',
  modelAnalyticsChart: 'trend',
  defaultTimeRangeDays: 1,
  defaultTimeGranularity: DEFAULT_TIME_GRANULARITY,
}

export const TIME_RANGE_BY_GRANULARITY = {
  hour: 1,
  day: 7,
  week: 30,
} as const

export const TIME_GRANULARITY_OPTIONS = [
  { label: 'Hour', value: 'hour' },
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
] as const

export const TIME_RANGE_PRESETS = [
  { label: '1 Day', days: 1 },
  { label: '7 Days', days: 7 },
  { label: '14 Days', days: 14 },
  { label: '29 Days', days: 29 },
] as const

export const CONSUMPTION_DISTRIBUTION_CHART_OPTIONS = [
  { value: 'bar', labelKey: 'Bar Chart' },
  { value: 'area', labelKey: 'Area Chart' },
] as const

export const MODEL_ANALYTICS_CHART_OPTIONS = [
  { value: 'trend', labelKey: 'Call Trend' },
  { value: 'proportion', labelKey: 'Call Count Distribution' },
  { value: 'top', labelKey: 'Call Count Ranking' },
] as const

export const EMPTY_DASHBOARD_FILTERS: DashboardFilters = {
  start_timestamp: undefined,
  end_timestamp: undefined,
  time_granularity: 'hour',
  username: '',
}
