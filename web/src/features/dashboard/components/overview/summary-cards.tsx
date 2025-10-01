import { useEffect, useMemo, useState } from 'react'
import { formatCurrencyUSD, formatNumber } from '@/lib/format'
import { getSelf, getStatus } from '@/features/auth/api'
import { createSummaryCardsConfig } from '@/features/dashboard/constants'
import { StatCard } from '../ui/stat-card'

export function SummaryCards() {
  const [self, setSelf] = useState<any>(null)
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([getSelf().catch(() => null), getStatus().catch(() => null)])
      .then(([s, st]) => {
        if (!mounted) return
        setSelf(s?.data || null)
        setStatus(st || null)
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false))

    return () => {
      mounted = false
    }
  }, [])

  const totals = useMemo(() => {
    const remainQuota = Number(self?.quota ?? 0)
    const usedQuota = Number(self?.used_quota ?? 0)
    const displayInCurrency = !!status?.display_in_currency
    const quotaPerUnit = Number(status?.quota_per_unit || 500000)
    const toUSD = (q: number) => (displayInCurrency ? q / quotaPerUnit : q)
    return {
      used: toUSD(usedQuota),
      remain: toUSD(remainQuota),
      requestCount: Number(self?.request_count ?? 0),
      currency: displayInCurrency,
    }
  }, [self, status])

  const items = createSummaryCardsConfig(totals).map((config) => ({
    title: config.title,
    value: config.formatAsCurrency
      ? formatCurrencyUSD(config.value)
      : formatNumber(config.value),
    desc: config.description,
    icon: config.icon,
  }))

  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
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
