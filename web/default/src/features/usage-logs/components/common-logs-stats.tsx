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
import { getRouteApi } from '@tanstack/react-router'
import { Fragment, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsAdmin } from '@/hooks/use-admin'
import { formatLogQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import { getLogStats, getUserLogStats } from '../api'
import { DEFAULT_LOG_STATS } from '../constants'
import { buildApiParams } from '../lib/utils'
import type { LogStatistics } from '../types'
import { useUsageLogsContext } from './usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')

function statNumber(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0
}

function formatStatNumber(value: number): string {
  return new Intl.NumberFormat().format(value)
}

function formatStatPercent(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)
}

function StatBadge(props: {
  label: string
  value: string | number
  accent: string
}) {
  return (
    <span className='border-border/60 bg-muted/25 inline-flex h-7 items-center gap-2 rounded-md border px-2.5 text-xs shadow-xs'>
      <span className={cn('h-3.5 w-0.5 rounded-full', props.accent)} />
      <span className='text-muted-foreground'>{props.label}</span>
      <span className='text-foreground/85 font-mono font-semibold tabular-nums'>
        {props.value}
      </span>
    </span>
  )
}

function TpmBreakdownHoverCard(props: { stats: LogStatistics | undefined }) {
  const { t } = useTranslation()
  const tpmStats = useMemo(
    () => ({
      cacheRead: statNumber(props.stats?.cache_read_tokens),
      cacheWrite: statNumber(props.stats?.cache_write_tokens),
      input: statNumber(props.stats?.input_tokens),
      output: statNumber(props.stats?.output_tokens),
    }),
    [
      props.stats?.cache_read_tokens,
      props.stats?.cache_write_tokens,
      props.stats?.input_tokens,
      props.stats?.output_tokens,
    ]
  )
  const tpmTotal = statNumber(props.stats?.tpm)
  const cacheHitBase = tpmStats.cacheRead + tpmStats.cacheWrite + tpmStats.input
  const cacheHitRate = cacheHitBase > 0 ? tpmStats.cacheRead / cacheHitBase : 0
  const tpmItems = useMemo(
    () => [
      {
        label: t('Cache Read'),
        value: tpmStats.cacheRead,
        accent: 'bg-emerald-500/70',
      },
      {
        label: t('Cache Write'),
        value: tpmStats.cacheWrite,
        accent: 'bg-amber-500/75',
      },
      {
        label: t('Input'),
        value: tpmStats.input,
        accent: 'bg-sky-500/70',
      },
      {
        label: t('Output'),
        value: tpmStats.output,
        accent: 'bg-violet-500/70',
      },
    ],
    [t, tpmStats]
  )

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        closeDelay={80}
        render={
          <span>
            <StatBadge
              label={t('TPM')}
              value={formatStatNumber(tpmTotal)}
              accent='bg-slate-400/70'
            />
          </span>
        }
      />
      <HoverCardContent
        align='end'
        className='w-[min(280px,calc(100vw-2rem))] p-2.5'
      >
        <div className='flex items-center justify-between gap-4 border-b pb-2'>
          <span className='text-muted-foreground text-xs'>
            {t('TPM')}
          </span>
          <span className='text-foreground font-mono text-sm font-semibold tabular-nums'>
            {formatStatNumber(tpmTotal)}
          </span>
        </div>
        <dl className='mt-2 grid gap-1'>
          {tpmItems.map((item, index) => (
            <Fragment key={item.label}>
              <div className='grid min-h-7 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-sm px-1.5 py-1'>
                <dt className='text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs'>
                  <span className={cn('h-2 w-2 rounded-full', item.accent)} />
                  <span className='truncate'>{item.label}</span>
                </dt>
                <dd className='text-foreground font-mono text-xs font-semibold tabular-nums'>
                  {formatStatNumber(item.value)}
                </dd>
              </div>
              {index === 1 ? (
                <div className='grid min-h-7 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-sm px-1.5 py-1'>
                  <dt className='text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs'>
                    <span className='h-2 w-2 rounded-full bg-teal-500/70' />
                    {t('Cache Hit Rate')}
                  </dt>
                  <dd className='text-foreground font-mono text-xs font-semibold tabular-nums'>
                    {formatStatPercent(cacheHitRate)}
                  </dd>
                </div>
              ) : null}
            </Fragment>
          ))}
        </dl>
      </HoverCardContent>
    </HoverCard>
  )
}

export function CommonLogsStats() {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()
  const searchParams = route.useSearch()
  const { sensitiveVisible } = useUsageLogsContext()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['usage-logs-stats', isAdmin, searchParams],
    queryFn: async () => {
      const params = buildApiParams({
        page: 1,
        pageSize: 1,
        searchParams,
        columnFilters: [],
        isAdmin,
      })

      const result = isAdmin
        ? await getLogStats(params)
        : await getUserLogStats(params)

      return result.success
        ? result.data || DEFAULT_LOG_STATS
        : DEFAULT_LOG_STATS
    },
    placeholderData: (previousData) => previousData,
  })

  if (isLoading) {
    return (
      <div className='flex items-center gap-2'>
        <Skeleton className='h-7 w-[150px] rounded-md' />
        <Skeleton className='h-7 w-[100px] rounded-md' />
        <Skeleton className='h-7 w-[120px] rounded-md' />
      </div>
    )
  }

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <StatBadge
        label={t('Usage')}
        value={sensitiveVisible ? formatLogQuota(stats?.quota || 0) : '••••'}
        accent='bg-sky-500/70'
      />
      <StatBadge
        label={t('RPM')}
        value={stats?.rpm || 0}
        accent='bg-rose-500/65'
      />
      <TpmBreakdownHoverCard stats={stats} />
    </div>
  )
}
