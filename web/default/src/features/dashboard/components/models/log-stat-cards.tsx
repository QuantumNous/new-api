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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StaggerContainer, StaggerItem } from '@/components/page-transition'
import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getUserQuotaDates } from '@/features/dashboard/api'
import { useModelStatCardsConfig } from '@/features/dashboard/hooks/use-dashboard-config'
import {
  buildQueryParams,
  calculateDashboardStats,
  getDefaultDays,
} from '@/features/dashboard/lib'
import type {
  QuotaDataItem,
  DashboardFilters,
} from '@/features/dashboard/types'
import { toIntlLocale } from '@/i18n/languages'
import { formatCompactNumber, formatNumber, formatQuota } from '@/lib/format'
import { computeTimeRange } from '@/lib/time'
import { cn } from '@/lib/utils'

import { useDashboardScope } from '../dashboard-scope'

interface LogStatCardsProps {
  filters?: DashboardFilters
  onDataUpdate?: (data: QuotaDataItem[], loading: boolean) => void
}

const MAX_INLINE_STAT_CHARS = 9

function formatStatNumber(value: number, locale: Intl.LocalesArgument) {
  const fullValue = formatNumber(value, locale)
  const displayValue =
    fullValue.length > MAX_INLINE_STAT_CHARS
      ? formatCompactNumber(value, locale)
      : fullValue

  return {
    displayValue,
    fullValue,
  }
}

export function LogStatCards(props: LogStatCardsProps) {
  const { i18n } = useTranslation()
  const statCardsConfig = useModelStatCardsConfig()
  const { isSiteWide: isAdmin } = useDashboardScope()
  const [stats, setStats] = useState<{
    totalQuota: number
    totalCount: number
    totalTokens: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [timeRangeMinutes, setTimeRangeMinutes] = useState(0)

  const { filters, onDataUpdate } = props

  useEffect(() => {
    const abortController = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)

    setError(false)
    onDataUpdate?.([], true)

    const timeRange = computeTimeRange(
      getDefaultDays(filters?.time_granularity),
      filters?.start_timestamp,
      filters?.end_timestamp
    )
    const timeDiff = (timeRange.end_timestamp - timeRange.start_timestamp) / 60
    setTimeRangeMinutes(timeDiff)

    void getUserQuotaDates(buildQueryParams(timeRange, filters), isAdmin)
      .then((res) => {
        if (abortController.signal.aborted) return
        const data = res?.data || []
        setStats(calculateDashboardStats(data))
        onDataUpdate?.(data, false)
      })
      .catch(() => {
        if (abortController.signal.aborted) return
        setStats(null)
        setError(true)
        onDataUpdate?.([], false)
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setLoading(false)
        }
      })

    return () => {
      abortController.abort()
    }
  }, [filters, isAdmin, onDataUpdate])

  const adaptedStats = {
    rpm: stats?.totalCount ?? 0,
    quota: stats?.totalQuota ?? 0,
    tpm: stats?.totalTokens ?? 0,
  }

  const items = statCardsConfig.map((config) => {
    const rawValue = config.getValue(adaptedStats, timeRangeMinutes)
    const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
    const formatted =
      config.key === 'quota'
        ? {
            displayValue: formatQuota(rawValue),
            fullValue: formatQuota(rawValue),
          }
        : formatStatNumber(rawValue, locale)

    return {
      title: config.title,
      value: formatted.displayValue,
      fullValue: formatted.fullValue,
      icon: config.icon,
      iconTone: config.iconTone,
    }
  })

  return (
    <StaggerContainer className='bg-border ring-border grid min-w-0 grid-cols-2 gap-px overflow-hidden rounded-xl ring-1 sm:grid-cols-3 lg:grid-cols-5'>
      {items.map((it, idx) => {
        const Icon = it.icon
        let valueContent
        if (loading) {
          valueContent = <Skeleton className='mt-2 h-7 w-16 sm:h-8 sm:w-20' />
        } else if (error) {
          valueContent = (
            <div className='text-muted-foreground mt-2 font-mono text-xl font-semibold tabular-nums sm:text-2xl'>
              --
            </div>
          )
        } else {
          valueContent = (
            <div
              className='text-foreground mt-2 max-w-full truncate font-mono text-xl font-semibold tabular-nums sm:text-2xl'
              title={it.fullValue}
            >
              {it.value}
            </div>
          )
        }

        return (
          <StaggerItem
            key={it.title}
            className={cn(
              'bg-card hover:bg-muted/20 min-w-0 px-3 py-3 transition-colors sm:px-5 sm:py-4',
              idx === items.length - 1 &&
                items.length % 2 !== 0 &&
                'col-span-2 sm:col-span-1'
            )}
          >
            <div className='flex min-w-0 items-center gap-2'>
              <IconBadge
                tone={it.iconTone}
                size='stat'
                className='size-6 rounded-md sm:size-7 [&>svg]:size-3 sm:[&>svg]:size-3.5'
              >
                <Icon />
              </IconBadge>
              <div className='text-muted-foreground truncate text-xs font-medium'>
                {it.title}
              </div>
            </div>
            {valueContent}
          </StaggerItem>
        )
      })}
    </StaggerContainer>
  )
}
