// ============================================================================
// Commission Type Definitions
// ============================================================================

export interface CommissionInfo {
  total_commission: number
  settled_commission: number
  pending_commission: number
  refunded_commission: number
  aff_code: string
  aff_count: number
  aff_quota: number
  aff_history_quota: number
}

export interface CommissionLog {
  id: number
  username: string
  level: number
  model_name: string
  consumption: number
  rate: number
  commission: number
  status: 'pending' | 'settled' | 'refunded'
  created_at: number
  settled_at?: number
}

export interface CommissionLogsResponse {
  items: CommissionLog[]
  total: number
}

export interface CommissionLevelStats {
  count: number
  total_commission: number
}

export interface CommissionStatsResponse {
  stats: {
    level1?: CommissionLevelStats
    level2?: CommissionLevelStats
    level3?: CommissionLevelStats
  }
  total_commission: number
  total_invites: number
  total_consumption: number
}

export interface ConsumptionLog {
  id: number
  model_name: string
  consumption: number
  request_count: number
  created_at: number
}

export interface ConsumptionLogsResponse {
  items: ConsumptionLog[]
  total: number
}

export interface CommissionTransferRequest {
  quota: number
}

export interface CommissionLogsParams {
  page?: number
  limit?: number
  status?: string
}

export interface ConsumptionLogsParams {
  page?: number
  limit?: number
}

export type CommissionPeriod = 'daily' | 'weekly' | 'monthly' | 'all'
