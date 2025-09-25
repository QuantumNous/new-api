import { useState, useEffect, useCallback } from 'react'
import {
  ApiResponse,
  ModelMonitoringData,
  ModelMonitoringStats,
  ModelInfo,
  QuotaDataItem,
} from '@/types/api'
import { toast } from 'sonner'
import { getStoredUser } from '@/lib/auth'
import { get } from '@/lib/http'

export interface ModelMonitoringFilters {
  startTimestamp: number
  endTimestamp: number
  businessGroup?: string
  searchTerm?: string
}

const initialFilters: ModelMonitoringFilters = {
  startTimestamp: Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000), // 7 days ago
  endTimestamp: Math.floor(Date.now() / 1000),
}

function isAdmin(): boolean {
  const user = getStoredUser()
  return !!(user && (user as any).role >= 10)
}

// 处理原始数据生成模型监控数据
function processModelData(data: QuotaDataItem[]): ModelMonitoringData {
  if (!data || data.length === 0) {
    return {
      stats: {
        total_models: 0,
        active_models: 0,
        total_requests: 0,
        avg_success_rate: 0,
      },
      models: [],
    }
  }

  // 按模型分组统计
  const modelMap = new Map<
    string,
    {
      quota_used: number
      quota_failed: number
      total_requests: number
      total_tokens: number
    }
  >()

  let totalRequests = 0

  data.forEach((item) => {
    const modelName = item.model_name
    const current = modelMap.get(modelName) || {
      quota_used: 0,
      quota_failed: 0,
      total_requests: 0,
      total_tokens: 0,
    }

    current.quota_used += item.quota
    current.total_requests += item.count
    current.total_tokens += item.tokens || 0
    // 假设失败数据在某个字段中，这里用示例数据
    // current.quota_failed += item.failed_quota || 0

    modelMap.set(modelName, current)
    totalRequests += item.count
  })

  // 生成模型列表
  const models: ModelInfo[] = Array.from(modelMap.entries())
    .map(([modelName, stats], index) => {
      const successRate =
        stats.total_requests > 0
          ? ((stats.total_requests - (stats.quota_failed || 0)) /
              stats.total_requests) *
            100
          : 0

      return {
        id: index + 1,
        model_name: modelName,
        business_group: '默认业务空间', // 示例数据
        quota_used: stats.quota_used,
        quota_failed: stats.quota_failed || 0,
        success_rate: successRate,
        avg_quota_per_request:
          stats.total_requests > 0
            ? stats.quota_used / stats.total_requests
            : 0,
        avg_tokens_per_request:
          stats.total_requests > 0
            ? stats.total_tokens / stats.total_requests
            : 0,
        operations: ['监控'],
      }
    })
    .sort((a, b) => b.quota_used - a.quota_used) // 按使用量排序

  // 生成统计数据
  const activeModels = models.filter((m) => m.quota_used > 0).length
  const avgSuccessRate =
    models.length > 0
      ? models.reduce((sum, m) => sum + m.success_rate, 0) / models.length
      : 0

  const stats: ModelMonitoringStats = {
    total_models: models.length,
    active_models: activeModels,
    total_requests: totalRequests,
    avg_success_rate: avgSuccessRate,
  }

  return { stats, models }
}

export function useModelMonitoring() {
  const [data, setData] = useState<ModelMonitoringData>({
    stats: {
      total_models: 0,
      active_models: 0,
      total_requests: 0,
      avg_success_rate: 0,
    },
    models: [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<ModelMonitoringFilters>(initialFilters)

  const currentIsAdmin = isAdmin()

  const fetchData = useCallback(
    async (currentFilters: ModelMonitoringFilters) => {
      setLoading(true)
      setError(null)
      try {
        const { startTimestamp, endTimestamp } = currentFilters
        const params = new URLSearchParams()
        params.append('start_timestamp', String(startTimestamp))
        params.append('end_timestamp', String(endTimestamp))
        params.append('default_time', 'day')

        // 使用现有的数据接口
        const url = currentIsAdmin
          ? `/api/data/?${params.toString()}`
          : `/api/data/self?${params.toString()}`

        const res = await get<ApiResponse<QuotaDataItem[]>>(url)

        if (res.success) {
          const processedData = processModelData(res.data || [])
          setData(processedData)
        } else {
          setError(res.message || 'Failed to fetch model monitoring data')
          toast.error(res.message || 'Failed to fetch model monitoring data')
        }
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred')
        toast.error(err.message || 'An unexpected error occurred')
      } finally {
        setLoading(false)
      }
    },
    [currentIsAdmin]
  )

  useEffect(() => {
    fetchData(filters)
  }, [filters, fetchData])

  const refresh = useCallback(() => {
    fetchData(filters)
  }, [fetchData, filters])

  const updateFilters = useCallback(
    (newFilters: Partial<ModelMonitoringFilters>) => {
      setFilters((prev) => ({ ...prev, ...newFilters }))
    },
    []
  )

  // 根据搜索词和业务组过滤模型
  const filteredModels = data.models.filter((model) => {
    const searchMatch =
      !filters.searchTerm ||
      model.model_name.toLowerCase().includes(filters.searchTerm.toLowerCase())

    const groupMatch =
      !filters.businessGroup ||
      filters.businessGroup === 'all' ||
      model.business_group === filters.businessGroup

    return searchMatch && groupMatch
  })

  return {
    data: { ...data, models: filteredModels },
    originalData: data,
    loading,
    error,
    refresh,
    updateFilters,
    filters,
    isAdmin: currentIsAdmin,
  }
}
