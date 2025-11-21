import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CreditCard } from 'lucide-react'
import { getSelf, getStatus } from '@/lib/api'
import { getCurrencyLabel, isCurrencyDisplayEnabled } from '@/lib/currency'
import { formatNumber, formatQuota } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { useSummaryCardsConfig } from '@/features/dashboard/hooks/use-dashboard-config'
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

  const summaryValues = useMemo(() => {
    const remainQuota = Number(self?.quota ?? 0)
    const usedQuota = Number(self?.used_quota ?? 0)
    const requestCount = Number(self?.request_count ?? 0)

    return {
      remainDisplay: formatQuota(remainQuota),
      usedDisplay: formatQuota(usedQuota),
      requestCountDisplay: formatNumber(requestCount),
    }
  }, [self])

  const currencyEnabledFromStore = isCurrencyDisplayEnabled()
  const statusCurrencyFlag =
    typeof status?.display_in_currency === 'boolean'
      ? Boolean(status.display_in_currency)
      : undefined
  const currencyEnabled =
    statusCurrencyFlag !== undefined
      ? statusCurrencyFlag
      : currencyEnabledFromStore
  const currencyLabel = currencyEnabled ? getCurrencyLabel() : 'Tokens'

  const items = useSummaryCardsConfig({
    ...summaryValues,
    currencyEnabled,
    currencyLabel,
  }).map((config, index) => ({
    title: config.title,
    value: config.value,
    desc: config.description,
    icon: config.icon,
    isBalance: index === 0,
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
