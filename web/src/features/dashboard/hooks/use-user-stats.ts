import { useState, useCallback, useEffect } from 'react'
import type { SelfResponse, UserSelf } from '@/types/api'
import { getStoredUser } from '@/lib/auth'
import { get } from '@/lib/http'

export interface UserStatsData {
  user: UserSelf | null
  quotaUsagePercentage: number
  requestsThisMonth: number
  balanceFormatted: string
  isLoading: boolean
  error: string | null
}

const formatBalance = (quota: number, usedQuota: number): string => {
  const remaining = Math.max(0, quota - usedQuota)
  if (remaining >= 1000000) {
    return `$${(remaining / 1000000).toFixed(1)}M`
  } else if (remaining >= 1000) {
    return `$${(remaining / 1000).toFixed(1)}K`
  } else {
    return `$${remaining.toFixed(2)}`
  }
}

const calculateUsagePercentage = (quota: number, usedQuota: number): number => {
  if (quota <= 0) return 0
  return Math.min(100, (usedQuota / quota) * 100)
}

export function useUserStats() {
  const [data, setData] = useState<UserStatsData>({
    user: null,
    quotaUsagePercentage: 0,
    requestsThisMonth: 0,
    balanceFormatted: '$0.00',
    isLoading: false,
    error: null,
  })

  const fetchUserStats = useCallback(async () => {
    setData((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      // 优先从本地存储获取基本用户信息
      const storedUser = getStoredUser()
      if (!storedUser) {
        throw new Error('User not logged in')
      }

      // 获取最新的用户详细信息
      const response = await get<SelfResponse>('/api/user/self')

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to fetch user stats')
      }

      const user = response.data
      const quota = user.quota || 0
      const usedQuota = user.used_quota || 0
      const requestCount = user.request_count || 0

      setData({
        user,
        quotaUsagePercentage: calculateUsagePercentage(quota, usedQuota),
        requestsThisMonth: requestCount,
        balanceFormatted: formatBalance(quota, usedQuota),
        isLoading: false,
        error: null,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unknown error occurred'
      setData((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }))
      console.error('User stats fetch error:', err)
    }
  }, [])

  const refresh = useCallback(() => {
    fetchUserStats()
  }, [fetchUserStats])

  // 初始加载
  useEffect(() => {
    fetchUserStats()
  }, [fetchUserStats])

  return {
    ...data,
    refresh,
  }
}
