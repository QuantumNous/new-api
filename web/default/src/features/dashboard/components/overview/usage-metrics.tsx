/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { getCurrencyLabel, isCurrencyDisplayEnabled } from '@/lib/currency'
import { formatNumber, formatQuota } from '@/lib/format'
import { computeTimeRange } from '@/lib/time'
import { useStatus } from '@/hooks/use-status'
import { Button } from '@/components/ui/button'
import { StaggerContainer, StaggerItem } from '@/components/page-transition'
import { getUserQuotaDates } from '@/features/dashboard/api'
import { useSummaryCardsConfig } from '@/features/dashboard/hooks/use-dashboard-config'
import { StatCard } from '../ui/stat-card'
import { BoostBalanceDialog } from './boost-balance-dialog'

export function UsageMetrics() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const { status, loading } = useStatus()
  const [boostOpen, setBoostOpen] = useState(false)

  const balance = Number(user?.quota ?? 0)
  const usedQuota = Number(user?.used_quota ?? 0)
  const requestCount = Number(user?.request_count ?? 0)

  const usageTrendQuery = useQuery({
    // Scoped to the signed-in user so switching accounts in the same session
    // can never surface the previous user's cached usage.
    queryKey: ['dashboard', 'overview', 'summary-sparklines', user?.id],
    queryFn: async () => {
      // Recomputed per fetch so a long-lived tab keeps a true trailing
      // 24-hour window; refetch-on-focus rolls it forward after idling.
      const summaryTimeRange = computeTimeRange(1)
      return getUserQuotaDates({
        start_timestamp: summaryTimeRange.start_timestamp,
        end_timestamp: summaryTimeRange.end_timestamp,
        default_time: 'hour',
      })
    },
    enabled: Boolean(user?.id),
    staleTime: 60 * 1000,
  })

  const recentUsage = useMemo(
    () =>
      (usageTrendQuery.data?.data ?? []).reduce(
        (total, item) => total + (Number(item.quota) || 0),
        0
      ),
    [usageTrendQuery.data?.data]
  )

  const currencyEnabledFromStore = isCurrencyDisplayEnabled()
  const statusCurrencyFlag =
    typeof status?.display_in_currency === 'boolean'
      ? Boolean(status.display_in_currency)
      : undefined
  const currencyEnabled =
    statusCurrencyFlag !== undefined
      ? statusCurrencyFlag
      : currencyEnabledFromStore

  const balanceDisplay = formatQuota(balance)

  const items = useSummaryCardsConfig({
    balanceDisplay,
    // A failed trend query reads as "unavailable", never as zero usage.
    todayUsageDisplay: usageTrendQuery.isError ? '—' : formatQuota(recentUsage),
    usedDisplay: formatQuota(usedQuota),
    requestCountDisplay: formatNumber(requestCount),
    currencyEnabled,
    currencyLabel: currencyEnabled ? getCurrencyLabel() : 'Tokens',
  })

  return (
    <section className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div className='flex flex-col gap-1'>
          <h2 className='text-lg font-semibold'>{t('Your usage')}</h2>
          <p className='text-muted-foreground text-sm'>
            {t('A quick look at your workspace activity.')}
          </p>
        </div>
        <Link
          to='/usage-logs'
          className='text-primary flex items-center gap-1 text-sm font-semibold hover:underline'
        >
          {t('View activity')}
          <ArrowRight className='size-4' aria-hidden='true' />
        </Link>
      </div>

      <StaggerContainer className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        {items.map((item) => (
          <StaggerItem
            key={item.key}
            className='bg-card rounded-xl border p-4 shadow-xs'
          >
            <StatCard
              title={item.title}
              value={item.value}
              description={item.description}
              icon={item.icon}
              action={
                item.key === 'balance' ? (
                  <Button
                    variant='ghost'
                    size='xs'
                    onClick={() => setBoostOpen(true)}
                  >
                    <Sparkles data-icon='inline-start' />
                    {t('Boost balance')}
                  </Button>
                ) : undefined
              }
              loading={
                loading ||
                // isLoading (not isPending) so a signed-out disabled query
                // does not read as an endless fetch.
                (item.key === 'todayUsage' && usageTrendQuery.isLoading)
              }
            />
          </StaggerItem>
        ))}
      </StaggerContainer>

      <BoostBalanceDialog
        open={boostOpen}
        onOpenChange={setBoostOpen}
        balanceDisplay={balanceDisplay}
        loading={loading}
      />
    </section>
  )
}
