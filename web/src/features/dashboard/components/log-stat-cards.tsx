import { useEffect, useState } from 'react'
import { Hash, Coins, Layers, Gauge, Zap } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { computeTimeRange } from '@/lib/time'
import { getLogsSelfStat } from '@/features/dashboard/api'
import { buildQueryParams } from '@/features/dashboard/utils'
import { StatCard } from './ui/stat-card'

export interface LogStatFilters {
  start_timestamp?: Date
  end_timestamp?: Date
  model_name?: string
  token_name?: string
}

export function LogStatCards({ filters }: { filters?: LogStatFilters }) {
  const [stat, setStat] = useState<{
    quota: number
    rpm: number
    tpm: number
    count?: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    const timeRange = computeTimeRange(
      30,
      filters?.start_timestamp,
      filters?.end_timestamp
    )
    const params = buildQueryParams(timeRange, filters)

    getLogsSelfStat(params)
      .then((res) => {
        if (!mounted) return
        setStat(res?.data || null)
      })
      .catch(() => setStat(null))
      .finally(() => mounted && setLoading(false))

    return () => {
      mounted = false
    }
  }, [filters])

  // rpm 实际是总次数，tpm 实际是总 tokens
  const count = stat?.rpm ?? 0
  const totalTokens = stat?.tpm ?? 0
  const quota = stat?.quota ?? 0

  // 计算平均值（按30天）
  const avgRpm = count > 0 ? Math.round(count / 30) : 0
  const avgTpm = totalTokens > 0 ? Math.round(totalTokens / 30) : 0

  const items = [
    {
      title: 'Total Count',
      value: formatNumber(count),
      desc: 'Statistical count',
      icon: Hash,
    },
    {
      title: 'Total Quota',
      value: formatNumber(quota),
      desc: 'Statistical quota',
      icon: Coins,
    },
    {
      title: 'Total Tokens',
      value: formatNumber(totalTokens),
      desc: 'Statistical tokens',
      icon: Layers,
    },
    {
      title: 'Average RPM',
      value: formatNumber(avgRpm),
      desc: 'Requests per minute',
      icon: Gauge,
    },
    {
      title: 'Average TPM',
      value: formatNumber(avgTpm),
      desc: 'Tokens per minute',
      icon: Zap,
    },
  ]

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
