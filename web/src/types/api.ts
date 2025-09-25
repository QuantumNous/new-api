// 统一的后端响应与 DTO 类型

export type ApiResponse<T> = {
  success: boolean
  message: string
  data?: T
}

// 基础用户信息（登录返回）
export interface UserBasic {
  id: number
  username: string
  display_name?: string
  role: number
  status: number
  group?: string
}

// /api/user/self 返回会更丰富
export interface UserSelf extends UserBasic {
  email?: string
  quota?: number
  used_quota?: number
  request_count?: number
  aff_code?: string
  aff_count?: number
  aff_quota?: number
  aff_history_quota?: number
  inviter_id?: number
  linux_do_id?: string
  setting?: unknown
  stripe_customer?: string
  sidebar_modules?: unknown
  permissions?: unknown
}

export type User = UserSelf | UserBasic

export type LoginTwoFAData = { require_2fa: true }
export type LoginSuccessData = UserBasic
export type LoginResponse = ApiResponse<LoginTwoFAData | LoginSuccessData>
export type Verify2FAResponse = ApiResponse<UserBasic>
// Dashboard 相关数据类型
export interface QuotaDataItem {
  count: number
  model_name: string
  quota: number
  created_at: number
  tokens?: number
}

export type QuotaDataResponse = ApiResponse<QuotaDataItem[]>

// 统计数据接口
export interface DashboardStats {
  totalQuota: number
  totalTokens: number
  totalRequests: number
  avgQuotaPerRequest: number
}

// 图表趋势数据
export interface TrendDataPoint {
  timestamp: number
  quota: number
  tokens: number
  count: number
}

// 模型使用分布数据
export interface ModelUsageData {
  model: string
  quota: number
  tokens: number
  count: number
  percentage: number
}

// 模型详细信息
export interface ModelInfo {
  id: number
  model_name: string
  business_group: string
  quota_used: number
  quota_failed: number
  success_rate: number
  avg_quota_per_request: number
  avg_tokens_per_request: number
  operations: string[]
}

// 模型监控统计数据
export interface ModelMonitoringStats {
  total_models: number
  active_models: number
  total_requests: number
  avg_success_rate: number
}

// 模型监控数据响应
export interface ModelMonitoringData {
  stats: ModelMonitoringStats
  models: ModelInfo[]
}

export type ModelMonitoringResponse = ApiResponse<ModelMonitoringData>

export type SelfResponse = ApiResponse<UserSelf>
