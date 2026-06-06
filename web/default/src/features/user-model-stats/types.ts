export interface StatsResponse<T = StatsItem> {
  success: boolean
  message?: string
  data: {
    total: number
    page: number
    page_size: number
    items: T[]
  }
}

export type StatsItem =
  | UserStatsItem
  | ModelStatsItem
  | DetailStatsItem

export interface UserStatsItem {
  [key: string]: unknown
  user_id: number
  username: string
  user_group: string
  count: number
  token_used: number
  quota: number
}

export interface ModelStatsItem {
  [key: string]: unknown
  model_name: string
  count: number
  token_used: number
  quota: number
}

export interface DetailStatsItem {
  [key: string]: unknown
  user_id: number
  username: string
  user_group: string
  model_name: string
  count: number
  token_used: number
  quota: number
}

export type ViewType = 'byUser' | 'byModel' | 'byDetail'
