import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CreditCard } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { getCurrencyLabel, isCurrencyDisplayEnabled } from '@/lib/currency'
import { formatNumber, formatQuota, formatTimestampToDate } from '@/lib/format'
import { useStatus } from '@/hooks/use-status'
import { Button } from '@/components/ui/button'
import { StaggerContainer, StaggerItem } from '@/components/page-transition'
import { useSummaryCardsConfig } from '@/features/dashboard/hooks/use-dashboard-config'
import { StatCard } from '../ui/stat-card'

function formatUptimeDuration(
  startTime: number | null | undefined,
  nowMs: number,
  t: (key: string) => string
) {
  if (!startTime) {
    return t('Unknown')
  }

  const totalMinutes = Math.max(0, Math.floor((nowMs - startTime * 1000) / 60000))
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60

  const parts: string[] = []

  if (days > 0) {
    parts.push(`${days} ${t(days === 1 ? 'Day' : 'days')}`)
  }
  if (hours > 0) {
    parts.push(`${hours} ${t(hours === 1 ? 'Hour' : 'hours')}`)
  }
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} ${t(minutes === 1 ? 'Minute' : 'minutes')}`)
  }

  return parts.join(' ')
}

export function SummaryCards() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const { status, loading } = useStatus()
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 60 * 1000)

    return () => window.clearInterval(timer)
  }, [])

  const summaryValues = useMemo(() => {
    const remainQuota = Number(user?.quota ?? 0)
    const usedQuota = Number(user?.used_quota ?? 0)
    const requestCount = Number(user?.request_count ?? 0)
    const startTime =
      (status?.start_time as number | undefined) ??
      (status?.data?.start_time as number | undefined)

    return {
      remainDisplay: formatQuota(remainQuota),
      usedDisplay: formatQuota(usedQuota),
      requestCountDisplay: formatNumber(requestCount),
      uptimeDisplay: formatUptimeDuration(startTime, nowMs, t),
      uptimeSinceDisplay: startTime
        ? formatTimestampToDate(startTime)
        : t('Unknown'),
    }
  }, [nowMs, status, t, user])

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
    <div className='overflow-hidden rounded-lg border'>
      <StaggerContainer className='grid sm:grid-cols-2 lg:grid-cols-4'>
        {items.map((it, idx) => (
          <StaggerItem
            key={it.title}
            className={`px-4 sm:px-5 ${
              idx > 0 ? 'border-t sm:border-l sm:border-t-0 lg:border-l' : ''
            }`}
          >
            <StatCard
              title={it.title}
              value={it.value}
              description={it.desc}
              icon={it.icon}
              loading={loading}
              action={
                it.isBalance ? (
                  <Button
                    variant='outline'
                    size='sm'
                    className='h-6 gap-1 px-2 text-xs'
                    asChild
                  >
                    <Link to='/wallet'>
                      <CreditCard className='size-3' />
                      {t('Recharge')}
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          </StaggerItem>
        ))}
      </StaggerContainer>
    </div>
  )
}
