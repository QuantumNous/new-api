import type { TimeGranularity } from '@/lib/time'

/**
 * Dashboard API 数据类型
 */
export interface QuotaDataItem {
  id?: number
  user_id?: number
  username?: string
  model_name?: string
  created_at: number
  token_used?: number
  count?: number
  quota?: number
}

export interface UptimeMonitor {
  name: string
  uptime: number
  status: number
  group?: string
}

export interface UptimeGroupResult {
  categoryName: string
  monitors: UptimeMonitor[]
}

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

/**
 * API Info 相关类型
 */
export interface ApiInfoItem {
  url: string
  route: string
  description: string
  color: string
}

export interface PingStatus {
  latency: number | null
  testing: boolean
  error: boolean
}

export type PingStatusMap = Record<string, PingStatus>

/**
 * 图表数据类型定义
 */
export interface ChartDataPoint {
  time: string
  [key: string]: number | string
}

export interface PieDataPoint {
  name: string
  value: number
  fill: string
}

export interface RankDataPoint {
  model: string
  count: number
  quota: number
  tokens: number
}

export interface TotalTrendDataPoint {
  time: string
  calls: number
  quota: number
}

export interface ProcessedChartData {
  uniqueModels: string[]
  distributionData: ChartDataPoint[]
  trendData: ChartDataPoint[]
  pieData: PieDataPoint[]
  rankData: RankDataPoint[]
  totalTrendData: TotalTrendDataPoint[]
  chartConfig: any // ChartConfig from @/components/ui/chart
}
