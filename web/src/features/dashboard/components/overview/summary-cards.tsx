import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CreditCard } from 'lucide-react'
import { getSelf, getStatus } from '@/lib/api'
import { formatCurrencyUSD, formatNumber } from '@/lib/format'
import { Button } from '@/components/ui/button'
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

  const items = createSummaryCardsConfig(totals).map((config, index) => ({
    title: config.title,
    value: config.formatAsCurrency
      ? formatCurrencyUSD(config.value)
      : formatNumber(config.value),
    desc: config.description,
    icon: config.icon,
    isBalance: index === 0, // First card is balance
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
          action={
            it.isBalance ? (
              <Button variant='outline' size='sm' className='h-7' asChild>
                <Link to='/wallet'>
                  <CreditCard className='mr-1.5 h-3.5 w-3.5' />
                  Recharge
                </Link>
              </Button>
            ) : undefined
          }
        />
      ))}
    </div>
  )
}
