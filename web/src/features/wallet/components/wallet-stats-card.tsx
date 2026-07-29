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
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Info,
  RefreshCw,
  WalletCards,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getUserSavingsLifetime } from '@/features/dashboard/api'
import {
  formatSavingsCNYMicros,
  formatSavingsPercent,
  getLifetimeSavingsViewState,
} from '@/features/dashboard/lib/savings'
import { savingsQueryKeys } from '@/features/dashboard/lib/savings-query-keys'
import { toIntlLocale } from '@/i18n/languages'
import { formatQuota, formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { UserWalletData } from '../types'

interface WalletStatsCardProps {
  user: UserWalletData | null
  loading?: boolean
}

export function WalletStatsCard(props: WalletStatsCardProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const lifetimeQuery = useQuery({
    queryKey: savingsQueryKeys.lifetime,
    queryFn: getUserSavingsLifetime,
    staleTime: 60 * 1000,
  })
  if (props.loading) {
    return (
      <div className='grid grid-cols-3 divide-x rounded-lg border'>
        {['balance', 'usage', 'requests'].map((key) => (
          <div key={key} className='min-w-0 px-2.5 py-2.5 sm:px-5 sm:py-4'>
            <Skeleton className='h-3.5 w-full' />
            <Skeleton className='mt-2 h-6 w-full sm:h-7' />
            <Skeleton className='mt-1.5 hidden h-3.5 w-24 md:block' />
          </div>
        ))}
      </div>
    )
  }

  const stats: {
    label: string
    value: string
    description: string
    icon: typeof WalletCards
    tone: IconBadgeTone
  }[] = [
    {
      label: t('Current Balance'),
      value: formatQuota(props.user?.quota ?? 0),
      description: t('Remaining quota'),
      icon: WalletCards,
      tone: 'success',
    },
    {
      label: t('Total Usage'),
      value: formatQuota(props.user?.used_quota ?? 0),
      description: t('Total consumed quota'),
      icon: BarChart3,
      tone: 'info',
    },
    {
      label: t('API Requests'),
      value: (props.user?.request_count ?? 0).toLocaleString(),
      description: t('Total requests made'),
      icon: Activity,
      tone: 'chart-4',
    },
  ]

  const lifetime = lifetimeQuery.data?.data
  const showLifetime = lifetime?.enabled && lifetime.show_on_wallet
  const lifetimeState = lifetime ? getLifetimeSavingsViewState(lifetime) : null
  const hasLifetimeAmount = Boolean(
    lifetime && lifetime.estimated_request_count > 0
  )
  const hasPositiveLifetimeSavings = Boolean(
    lifetime && /^[1-9]\d*$/.test(lifetime.savings_cny_micros)
  )
  const lifetimeTitle =
    lifetimeState === 'complete' ||
    lifetimeState === 'empty' ||
    lifetimeState === 'no_estimates'
      ? t('Lifetime savings')
      : t('Lifetime savings counted so far')
  let lifetimeValue = ''
  let lifetimeDescription = ''

  if (lifetime && lifetimeState) {
    const coverage = formatSavingsPercent(lifetime.coverage_ratio, locale)
    const coverageText =
      coverage === '-'
        ? `${t('Coverage')}: -`
        : t('{{coverage}} coverage', { coverage })

    if (hasLifetimeAmount) {
      lifetimeValue = formatSavingsCNYMicros(
        lifetime.savings_cny_micros,
        locale
      )
    } else if (lifetimeState === 'empty') {
      lifetimeValue = t('No lifetime savings records yet')
    } else if (lifetimeState === 'failed') {
      lifetimeValue = t('Historical savings backfill failed')
    } else {
      lifetimeValue = t('No eligible savings records yet')
    }

    if (lifetimeState === 'complete') {
      lifetimeDescription =
        lifetime.statistics_started_at > 0
          ? t('Since {{date}} · {{coverage}} coverage', {
              date: formatTimestampToDate(lifetime.statistics_started_at),
              coverage,
            })
          : coverageText
    } else if (lifetimeState === 'no_estimates') {
      lifetimeDescription = coverageText
    } else if (lifetimeState === 'failed') {
      lifetimeDescription = lifetime.request_count
        ? `${coverageText} · ${t(
            'Historical savings backfill failed; results are incomplete.'
          )}`
        : t('Historical savings backfill failed; results are incomplete.')
    } else if (lifetimeState === 'paused') {
      lifetimeDescription = `${coverageText} · ${t(
        'System historical data counting is paused'
      )}`
    } else if (lifetimeState === 'not_started') {
      lifetimeDescription = lifetime.request_count
        ? `${coverageText} · ${t('Historical usage has not been backfilled')}`
        : t('Historical usage has not been backfilled')
    } else if (lifetimeState === 'processing') {
      lifetimeDescription = `${coverageText} · ${t(
        'System historical data is being counted'
      )}`
    }
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='grid grid-cols-3 divide-x'>
        {stats.map((item) => (
          <div
            key={item.label}
            className='min-w-0 px-2.5 py-2.5 sm:px-5 sm:py-4'
          >
            <div className='flex items-center gap-1.5 sm:gap-2.5'>
              <IconBadge tone={item.tone} size='stat'>
                <item.icon />
              </IconBadge>
              <div className='text-muted-foreground truncate text-[11px] font-medium tracking-wider uppercase sm:text-xs'>
                {item.label}
              </div>
            </div>

            <div className='text-foreground mt-1.5 font-mono text-sm font-bold tracking-tight break-all tabular-nums sm:mt-2.5 sm:text-2xl'>
              {item.value}
            </div>
            <div className='text-muted-foreground/60 mt-1 hidden text-xs md:block'>
              {item.description}
            </div>
          </div>
        ))}
      </div>
      {showLifetime && (
        <div className='bg-muted/30 min-w-0 border-t px-3 py-3 sm:px-5 sm:py-4'>
          <div className='flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6'>
            <div className='min-w-0'>
              <div className='text-muted-foreground flex items-center gap-2 text-xs font-medium'>
                <IconBadge tone='success' size='sm'>
                  <BadgeDollarSign aria-hidden='true' />
                </IconBadge>
                <span>{lifetimeTitle}</span>
              </div>
              <div
                className={cn(
                  'text-foreground mt-2 font-mono text-lg font-bold break-all tabular-nums sm:text-xl',
                  hasPositiveLifetimeSavings && 'text-success',
                  !hasLifetimeAmount &&
                    'text-muted-foreground font-sans text-sm font-medium'
                )}
              >
                {lifetimeValue}
              </div>
            </div>

            <div className='min-w-0 space-y-1 sm:max-w-[34rem] sm:text-right'>
              <div className='text-muted-foreground flex items-center gap-1 text-xs sm:justify-end'>
                <span>{t('Estimated from official public pricing')}</span>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type='button'
                        className='hover:text-foreground inline-flex shrink-0'
                        aria-label={t('About official pricing estimates')}
                      />
                    }
                  >
                    <Info className='size-3.5' aria-hidden='true' />
                  </TooltipTrigger>
                  <TooltipContent className='max-w-72'>
                    {t(
                      'Official prices are confirmed snapshots from the model marketplace; estimates are for cost comparison only.'
                    )}
                  </TooltipContent>
                </Tooltip>
              </div>
              {lifetimeDescription && (
                <div
                  className={cn(
                    'text-muted-foreground text-xs leading-relaxed',
                    (lifetimeState === 'failed' ||
                      lifetimeState === 'paused') &&
                      'text-warning'
                  )}
                >
                  {lifetimeDescription}
                </div>
              )}
              {lifetimeQuery.isRefetchError && (
                <div className='text-warning flex items-center gap-1 text-xs sm:justify-end'>
                  <span>{t('Savings data update failed')}</span>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon-sm'
                          onClick={() => void lifetimeQuery.refetch()}
                          aria-label={t('Reload savings data')}
                        />
                      }
                    >
                      <RefreshCw aria-hidden='true' />
                    </TooltipTrigger>
                    <TooltipContent>{t('Reload savings data')}</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
