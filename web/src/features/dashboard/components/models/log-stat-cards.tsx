import { useEffect, useState } from 'react'
import { formatNumber } from '@/lib/format'
import { computeTimeRange } from '@/lib/time'
import {
  getUserQuotaDates,
  calculateDashboardStats,
  type QuotaDataItem,
} from '@/features/dashboard/api'
import { MODEL_STAT_CARDS_CONFIG } from '@/features/dashboard/constants'
import { type DashboardFilters } from '@/features/dashboard/types'
import { buildQueryParams } from '@/features/dashboard/utils'
import { StatCard } from '../ui/stat-card'

interface LogStatCardsProps {
  filters?: DashboardFilters
  onDataUpdate?: (data: QuotaDataItem[], loading: boolean) => void
}

export function LogStatCards({ filters, onDataUpdate }: LogStatCardsProps) {
  const [stats, setStats] = useState<{
    totalQuota: number
    totalCount: number
    totalTokens: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    onDataUpdate?.([], true) // 通知父组件开始加载

    const timeRange = computeTimeRange(
      30,
      filters?.start_timestamp,
      filters?.end_timestamp
    )
    const params = buildQueryParams(timeRange, filters)

    getUserQuotaDates(params)
      .then((res) => {
        if (!mounted) return
        const data = res?.data || []
        const calculatedStats = calculateDashboardStats(data)
        setStats(calculatedStats)
        onDataUpdate?.(data, false) // 通知父组件数据已加载
      })
      .catch(() => {
        setStats(null)
        onDataUpdate?.([], false)
      })
      .finally(() => mounted && setLoading(false))

    return () => {
      mounted = false
    }
  }, [filters, onDataUpdate])

  // 构造数据适配器，将新的数据格式转换为配置期望的格式
  const adaptedStats = {
    rpm: stats?.totalCount ?? 0, // 总次数
    quota: stats?.totalQuota ?? 0, // 总额度
    tpm: stats?.totalTokens ?? 0, // 总 tokens
  }

  const items = MODEL_STAT_CARDS_CONFIG.map((config) => ({
    title: config.title,
    value: formatNumber(config.getValue(adaptedStats, 30)),
    desc: config.description,
    icon: config.icon,
  }))

  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-5'>
      {items.map((it) => (
        <StatCard
          key={it.title}
          title={it.title}
          value={it.value}
          description={it.desc}
          icon={it.icon}
          loading={loading}
        />
      ))}
    </div>
  )
}
