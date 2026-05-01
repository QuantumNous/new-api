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
    key: config.key,
    title: config.title,
    value: config.value,
    desc: config.description,
    icon: config.icon,
    isBalance: index === 0,
    isUptime: config.key === 'uptime',
  }))

  return (
    <div className='overflow-hidden rounded-lg border'>
      <StaggerContainer className='grid sm:grid-cols-2 lg:grid-cols-4'>
        {items.map((it, idx) => (
          <StaggerItem
            key={it.key}
            className={`px-4 sm:px-5 ${
              idx > 0 ? 'border-t sm:border-l sm:border-t-0 lg:border-l' : ''
            } ${it.isUptime ? 'lg:col-span-2' : ''}`}
          >
            {it.isUptime ? (
              <div className='relative py-3'>
                <div className='from-border/0 via-cyan-400/70 to-border/0 absolute inset-x-8 top-0 h-px bg-gradient-to-r' />
                <div className='absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-sky-500/10 opacity-90' />
                <div className='absolute -top-10 right-0 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl' />
                <div className='absolute -bottom-12 left-8 h-28 w-28 rounded-full bg-sky-500/10 blur-3xl' />

                <div className='relative rounded-2xl border border-cyan-500/20 bg-background/85 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_28px_rgba(34,211,238,0.08)] backdrop-blur-sm sm:px-5 sm:py-5'>
                  <div className='mb-3 flex items-start justify-between gap-3'>
                    <div className='text-muted-foreground flex items-center gap-2 text-[11px] font-medium tracking-[0.22em] uppercase'>
                      <it.icon className='size-4 text-cyan-300/80' />
                      {it.title}
                    </div>
                    <div className='rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 font-mono text-[10px] tracking-[0.24em] text-cyan-200 uppercase'>
                      Live
                    </div>
                  </div>

                  {loading ? (
                    <div className='space-y-2'>
                      <div className='bg-muted h-10 w-40 animate-pulse rounded-md' />
                      <div className='bg-muted h-4 w-56 animate-pulse rounded-md' />
                    </div>
                  ) : (
                    <>
                      <div className='bg-gradient-to-r from-cyan-100 via-white to-sky-200 bg-clip-text font-mono text-4xl font-black tracking-tight text-transparent drop-shadow-[0_0_18px_rgba(56,189,248,0.18)] sm:text-5xl'>
                        {it.value}
                      </div>
                      <p className='text-muted-foreground/80 mt-2 text-sm'>
                        {it.desc}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : (
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
            )}
          </StaggerItem>
        ))}
      </StaggerContainer>
    </div>
  )
}
