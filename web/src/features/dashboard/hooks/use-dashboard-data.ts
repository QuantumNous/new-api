import { useState, useCallback, useEffect } from 'react'
import type {
  QuotaDataResponse,
  QuotaDataItem,
  DashboardStats,
  TrendDataPoint,
  ModelUsageData,
} from '@/types/api'
import { getStoredUser } from '@/lib/auth'
import { get } from '@/lib/http'

export interface DashboardFilters {
  startTimestamp: number
  endTimestamp: number
  username?: string
  defaultTime?: 'hour' | 'day' | 'week'
}

export interface ProcessedDashboardData {
  stats: DashboardStats
  trendData: TrendDataPoint[]
  modelUsage: ModelUsageData[]
  rawData: QuotaDataItem[]
}

const DEFAULT_FILTERS: DashboardFilters = {
  startTimestamp: Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000), // 7 days ago
  endTimestamp: Math.floor(Date.now() / 1000),
  defaultTime: 'day',
}

function isAdmin(): boolean {
  const user = getStoredUser()
  return !!(user && (user as any).role >= 10)
}

function processQuotaData(data: QuotaDataItem[]): ProcessedDashboardData {
  if (!data || data.length === 0) {
    return {
      stats: {
        totalQuota: 0,
        totalTokens: 0,
        totalRequests: 0,
        avgQuotaPerRequest: 0,
      },
      trendData: [],
      modelUsage: [],
      rawData: [],
    }
  }

  // 计算总统计
  const totalQuota = data.reduce((sum, item) => sum + (item.quota || 0), 0)
  const totalTokens = data.reduce((sum, item) => sum + (item.tokens || 0), 0)
  const totalRequests = data.reduce((sum, item) => sum + (item.count || 0), 0)
  const avgQuotaPerRequest = totalRequests > 0 ? totalQuota / totalRequests : 0

  const stats: DashboardStats = {
    totalQuota,
    totalTokens,
    totalRequests,
    avgQuotaPerRequest,
  }

  // 按时间聚合趋势数据
  const timeAggregation = new Map<
    number,
    { quota: number; tokens: number; count: number }
  >()

  data.forEach((item) => {
    // 按小时/天/周聚合（这里简化为按天）
    const dayTimestamp = Math.floor(item.created_at / 86400) * 86400
    const existing = timeAggregation.get(dayTimestamp) || {
      quota: 0,
      tokens: 0,
      count: 0,
    }
    timeAggregation.set(dayTimestamp, {
      quota: existing.quota + (item.quota || 0),
      tokens: existing.tokens + (item.tokens || 0),
      count: existing.count + (item.count || 0),
    })
  })

  const trendData: TrendDataPoint[] = Array.from(timeAggregation.entries())
    .map(([timestamp, data]) => ({
      timestamp,
      ...data,
    }))
    .sort((a, b) => a.timestamp - b.timestamp)

  // 按模型聚合使用分布
  const modelAggregation = new Map<
    string,
    { quota: number; tokens: number; count: number }
  >()

  data.forEach((item) => {
    const model = item.model_name || 'unknown'
    const existing = modelAggregation.get(model) || {
      quota: 0,
      tokens: 0,
      count: 0,
    }
    modelAggregation.set(model, {
      quota: existing.quota + (item.quota || 0),
      tokens: existing.tokens + (item.tokens || 0),
      count: existing.count + (item.count || 0),
    })
  })

  const modelUsage: ModelUsageData[] = Array.from(modelAggregation.entries())
    .map(([model, data]) => ({
      model,
      ...data,
      percentage: totalQuota > 0 ? (data.quota / totalQuota) * 100 : 0,
    }))
    .sort((a, b) => b.quota - a.quota)

  return {
    stats,
    trendData,
    modelUsage,
    rawData: data,
  }
}

export function useDashboardData() {
  const [data, setData] = useState<ProcessedDashboardData>({
    stats: {
      totalQuota: 0,
      totalTokens: 0,
      totalRequests: 0,
      avgQuotaPerRequest: 0,
    },
    trendData: [],
    modelUsage: [],
    rawData: [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS)

  const fetchData = useCallback(
    async (customFilters?: Partial<DashboardFilters>) => {
      setLoading(true)
      setError(null)

      try {
        const currentFilters = { ...filters, ...customFilters }
        const admin = isAdmin()

        let url: string
        if (admin) {
          url = `/api/data/?start_timestamp=${currentFilters.startTimestamp}&end_timestamp=${currentFilters.endTimestamp}&default_time=${currentFilters.defaultTime || 'day'}`
          if (currentFilters.username) {
            url += `&username=${encodeURIComponent(currentFilters.username)}`
          }
        } else {
          url = `/api/data/self?start_timestamp=${currentFilters.startTimestamp}&end_timestamp=${currentFilters.endTimestamp}&default_time=${currentFilters.defaultTime || 'day'}`
        }

        const response = await get<QuotaDataResponse>(url)

        if (!response.success) {
          throw new Error(response.message || 'Failed to fetch dashboard data')
        }

        const processedData = processQuotaData(response.data || [])
        setData(processedData)
        setFilters(currentFilters)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'An unknown error occurred'
        setError(message)
        console.error('Dashboard data fetch error:', err)
      } finally {
        setLoading(false)
      }
    },
    [filters]
  )

  const updateFilters = useCallback((newFilters: Partial<DashboardFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
  }, [])

  const refresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  // 初始加载
  useEffect(() => {
    fetchData()
  }, [])

  return {
    data,
    loading,
    error,
    filters,
    updateFilters,
    fetchData,
    refresh,
    isAdmin: isAdmin(),
  }
}
