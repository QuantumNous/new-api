import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import {
  getAllLogs,
  getUserLogs,
  getLogStats,
  getUserLogStats,
  searchAllLogs,
  searchUserLogs,
  type GetLogsParams,
  type GetLogStatsParams,
} from '../api'
import type { UsageLog, LogStatistics } from '../data/schema'
import { timestampToSeconds } from '../lib/utils'

export interface UseUsageLogsOptions {
  params: GetLogsParams
  enabled?: boolean
}

export interface UseUsageLogsResult {
  logs: UsageLog[]
  total: number
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useUsageLogs({
  params,
  enabled = true,
}: UseUsageLogsOptions): UseUsageLogsResult {
  const user = useAuthStore((state) => state.auth.user)
  const isAdmin = user?.role === 100

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['usage-logs', isAdmin, params],
    queryFn: async () => {
      const apiParams = {
        ...params,
        start_timestamp: timestampToSeconds(params.start_timestamp),
        end_timestamp: timestampToSeconds(params.end_timestamp),
      }

      const result = isAdmin
        ? await getAllLogs(apiParams)
        : await getUserLogs(apiParams)

      if (!result.success) {
        toast.error(result.message || 'Failed to load logs')
        return { items: [], total: 0 }
      }

      return {
        items: result.data?.items || [],
        total: result.data?.total || 0,
      }
    },
    enabled,
    placeholderData: (previousData) => previousData,
  })

  return {
    logs: data?.items || [],
    total: data?.total || 0,
    isLoading,
    error: error as Error | null,
    refetch,
  }
}

export interface UseLogStatisticsOptions {
  params: GetLogStatsParams
  enabled?: boolean
}

export interface UseLogStatisticsResult {
  statistics: LogStatistics | null
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useLogStatistics({
  params,
  enabled = true,
}: UseLogStatisticsOptions): UseLogStatisticsResult {
  const user = useAuthStore((state) => state.auth.user)
  const isAdmin = user?.role === 100

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['log-statistics', isAdmin, params],
    queryFn: async () => {
      const apiParams = {
        ...params,
        start_timestamp: timestampToSeconds(params.start_timestamp),
        end_timestamp: timestampToSeconds(params.end_timestamp),
      }

      const result = isAdmin
        ? await getLogStats(apiParams)
        : await getUserLogStats(apiParams)

      if (!result.success) {
        toast.error(result.message || 'Failed to load statistics')
        return null
      }

      return result.data || null
    },
    enabled,
    placeholderData: (previousData) => previousData,
  })

  return {
    statistics: data || null,
    isLoading,
    error: error as Error | null,
    refetch,
  }
}

export interface UseLogSearchOptions {
  keyword: string
  enabled?: boolean
}

export interface UseLogSearchResult {
  logs: UsageLog[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useLogSearch({
  keyword,
  enabled = true,
}: UseLogSearchOptions): UseLogSearchResult {
  const user = useAuthStore((state) => state.auth.user)
  const isAdmin = user?.role === 100

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['log-search', isAdmin, keyword],
    queryFn: async () => {
      if (!keyword.trim()) {
        return []
      }

      const result = isAdmin
        ? await searchAllLogs({ keyword })
        : await searchUserLogs({ keyword })

      if (!result.success) {
        toast.error(result.message || 'Failed to search logs')
        return []
      }

      return result.data || []
    },
    enabled: enabled && !!keyword.trim(),
    placeholderData: (previousData) => previousData,
  })

  return {
    logs: data || [],
    isLoading,
    error: error as Error | null,
    refetch,
  }
}

// Hook to invalidate logs cache
export function useInvalidateLogs() {
  const queryClient = useQueryClient()

  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['usage-logs'] })
    queryClient.invalidateQueries({ queryKey: ['log-statistics'] })
    queryClient.invalidateQueries({ queryKey: ['log-search'] })
  }, [queryClient])
}
