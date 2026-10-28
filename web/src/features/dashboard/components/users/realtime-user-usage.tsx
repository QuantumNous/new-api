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
*/
import { useQuery } from '@tanstack/react-query'
import { VChart } from '@visactor/react-vchart'
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Check,
  Gauge,
  RefreshCw,
  Search,
  TriangleAlert,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useTheme } from '@/context/theme-provider'
import { getRealtimeUserUsage } from '@/features/dashboard/api'
import type {
  RealtimeUsageSnapshot,
  RealtimeUsageUser,
} from '@/features/dashboard/types'
import { formatNumber, formatTimestamp } from '@/lib/format'
import { VCHART_OPTION } from '@/lib/vchart'
import { cn } from '@/lib/utils'

const REALTIME_PARAMS = {
  window_seconds: 60,
  trend_minutes: 60,
  limit: 100,
} as const

type SortKey = 'tpm' | 'requests' | 'total_tokens' | 'error_rate'
type SortDirection = 'asc' | 'desc'

const SORT_LABEL_KEYS: Record<SortKey, string> = {
  requests: 'Requests',
  total_tokens: 'Tokens',
  tpm: 'Realtime TPM',
  error_rate: 'Error rate',
}

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

function formatPercent(value: number) {
  return Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value)
}

function statusTone(user: RealtimeUsageUser): IconBadgeTone {
  if (user.error_rate >= 0.2) return 'destructive'
  if (user.error_rate >= 0.05) return 'warning'
  return 'success'
}

function statusDotClass(user: RealtimeUsageUser) {
  const tone = statusTone(user)
  if (tone === 'destructive') return 'bg-destructive'
  if (tone === 'warning') return 'bg-warning'
  return 'bg-success'
}

function errorRateClass(errorRate: number) {
  if (errorRate >= 0.2) return 'text-destructive'
  if (errorRate >= 0.05) return 'text-warning'
  return 'text-muted-foreground'
}

function sortAriaValue(
  activeKey: SortKey,
  key: SortKey,
  direction: SortDirection
) {
  if (activeKey !== key) return 'none' as const
  return direction === 'asc' ? ('ascending' as const) : ('descending' as const)
}

function getRealtimeStatus(
  hasInitialError: boolean,
  isStale: boolean,
  pageVisible: boolean,
  autoRefresh: boolean,
  translate: (key: string) => string
) {
  if (hasInitialError) {
    return { label: translate('Error'), variant: 'destructive' as const }
  }
  if (isStale) {
    return { label: translate('stale'), variant: 'warning' as const }
  }
  return {
    label: translate(pageVisible && autoRefresh ? 'Live' : 'Paused'),
    variant: 'secondary' as const,
  }
}

function realtimeStatusDotClass(
  hasInitialError: boolean,
  isStale: boolean,
  pageVisible: boolean,
  autoRefresh: boolean
) {
  if (hasInitialError) return 'bg-destructive'
  if (isStale || !pageVisible || !autoRefresh) return 'bg-warning'
  return 'bg-success animate-pulse'
}

function chartSpec(
  title: string,
  trend: RealtimeUsageSnapshot['trend']
) {
  return {
    type: 'line',
    data: [
      {
        id: 'realtime-trend',
        values: trend.map((point) => ({
          Time: new Date(point.timestamp * 1000).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          Requests: point.requests,
          Tokens: point.total_tokens,
        })),
      },
    ],
    xField: 'Time',
    yField: 'Tokens',
    title: { visible: true, text: title },
    axes: [
      { orient: 'bottom', type: 'band' },
      { orient: 'left', type: 'linear' },
    ],
    legends: { visible: false },
    tooltip: { dimension: { visible: true } },
    background: { fill: 'transparent' },
    animation: false,
  }
}

function SummaryCard(props: {
  label: string
  value: string
  icon: typeof Users
  tone: IconBadgeTone
}) {
  const Icon = props.icon
  return (
    <div className='rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3'>
      <div className='flex items-center gap-2'>
        <IconBadge tone={props.tone} size='sm'>
          <Icon />
        </IconBadge>
        <span className='text-muted-foreground text-xs'>{props.label}</span>
      </div>
      <div className='mt-1.5 font-mono text-xl font-semibold tabular-nums'>
        {props.value}
      </div>
    </div>
  )
}

export function RealtimeUserUsage() {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === 'undefined' || !document.hidden
  )
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('tpm')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [themeReady, setThemeReady] = useState(false)
  const themeManagerRef = useRef<
    (typeof import('@visactor/vchart'))['ThemeManager'] | null
  >(null)

  useEffect(() => {
    const handleVisibility = () => setPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useEffect(() => {
    let disposed = false
    const updateTheme = async () => {
      if (!themeManagerPromise) {
        themeManagerPromise = import('@visactor/vchart').then(
          (module) => module.ThemeManager
        )
      }
      const ThemeManager = await themeManagerPromise
      if (disposed) return
      themeManagerRef.current = ThemeManager
      ThemeManager.setCurrentTheme(resolvedTheme === 'dark' ? 'dark' : 'light')
      setThemeReady(true)
    }
    updateTheme()
    return () => {
      disposed = true
    }
  }, [resolvedTheme])

  const usageQuery = useQuery({
    queryKey: ['dashboard', 'realtime-user-usage', REALTIME_PARAMS],
    queryFn: async () => {
      const response = await getRealtimeUserUsage(REALTIME_PARAMS)
      if (!response.success) {
        throw new Error(response.message || t('Unable to load realtime usage'))
      }
      return response.data
    },
    enabled: pageVisible,
    refetchInterval: autoRefresh && pageVisible ? 5000 : false,
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
    retry: 1,
  })

  const snapshot = usageQuery.data
  const users = useMemo(() => snapshot?.users ?? [], [snapshot])
  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return users
      .filter((user) => user.username.toLowerCase().includes(normalizedSearch))
      .sort((left, right) => {
        const leftValue = left[sortKey]
        const rightValue = right[sortKey]
        const comparison = Number(leftValue) - Number(rightValue)
        return sortDirection === 'asc' ? comparison : -comparison
      })
  }, [search, sortDirection, sortKey, users])

  const selectedUser = users.find((user) => user.user_id === selectedUserId)
  const trendTitle = selectedUser
    ? `${t('Realtime trend')} · ${selectedUser.username}`
    : t('Realtime trend')
  const trend = selectedUser
    ? snapshot?.user_trends?.[String(selectedUser.user_id)] ?? snapshot?.trend
    : snapshot?.trend
  const trendSpec = snapshot && trend ? chartSpec(trendTitle, trend) : null
  const isStale = Boolean(usageQuery.isError && snapshot)
  const isInitialLoading = usageQuery.isLoading && !snapshot
  const isEmpty = !isInitialLoading && !usageQuery.isError && users.length === 0
  const hasInitialError = Boolean(usageQuery.isError && !snapshot)
  const errorStatus = (usageQuery.error as { response?: { status?: number } } | null)
    ?.response?.status
  const status = getRealtimeStatus(
    hasInitialError,
    isStale,
    pageVisible,
    autoRefresh,
    t
  )

  const toggleSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(nextKey)
    setSortDirection('desc')
  }

  useEffect(() => {
    if (selectedUserId !== null && !users.some((user) => user.user_id === selectedUserId)) {
      setSelectedUserId(null)
    }
  }, [selectedUserId, users])

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 sm:px-4'>
        <div className='flex items-center gap-2'>
          <span
            className={cn(
              'size-2 rounded-full',
              realtimeStatusDotClass(
                hasInitialError,
                isStale,
                pageVisible,
                autoRefresh
              )
            )}
            aria-hidden='true'
          />
          <span className='text-sm font-semibold'>{t('Realtime status')}</span>
          <Badge variant={status.variant}>{status.label}</Badge>
          {snapshot && (
            <span className='text-muted-foreground text-xs'>
              {t('Last updated')}: {formatTimestamp(snapshot.updated_at)}
            </span>
          )}
        </div>
        <div className='flex items-center gap-2'>
          <label className='text-muted-foreground flex items-center gap-1.5 text-xs'>
            <Switch
              size='sm'
              checked={autoRefresh}
              onCheckedChange={(checked) => setAutoRefresh(Boolean(checked))}
              aria-label={t('Auto-refresh')}
            />
            {t('Auto-refresh')}
          </label>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => usageQuery.refetch()}
            disabled={usageQuery.isFetching}
          >
            <RefreshCw className={cn(usageQuery.isFetching && 'animate-spin')} />
            <span className='hidden sm:inline'>{t('Refresh now')}</span>
          </Button>
        </div>
      </div>

      {isInitialLoading && (
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          {['active', 'requests', 'tpm', 'errors'].map((key) => (
            <Skeleton key={key} className='h-20 rounded-lg' />
          ))}
        </div>
      )}

      {usageQuery.isError && !snapshot ? (
        <div className='rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center'>
          <TriangleAlert className='text-destructive mx-auto mb-2 size-5' />
          <p className='text-sm font-medium'>
            {errorStatus === 403
              ? t('You do not have permission to view realtime usage')
              : t('Unable to load realtime usage')}
          </p>
        </div>
      ) : (
        snapshot && (
          <>
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
              <SummaryCard label={t('Active users')} value={formatNumber(snapshot.summary.active_users)} icon={Users} tone='success' />
              <SummaryCard label={t('Requests')} value={formatNumber(snapshot.summary.requests)} icon={Activity} tone='info' />
              <SummaryCard label={t('Realtime TPM')} value={formatNumber(snapshot.summary.tpm)} icon={Gauge} tone='warning' />
              <SummaryCard label={t('Error rate')} value={formatPercent(snapshot.summary.error_rate)} icon={TriangleAlert} tone={snapshot.summary.error_rate >= 0.05 ? 'warning' : 'success'} />
            </div>

            {isStale && (
              <div className='text-warning flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs'>
                <TriangleAlert className='size-3.5' />
                {t('Unable to load realtime usage')} · {t('stale')}
              </div>
            )}

            {isEmpty ? (
              <div className='text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-sm'>
                {t('No realtime usage data')}
              </div>
            ) : (
              <div className='grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]'>
                <div className='overflow-hidden rounded-lg border'>
                  <div className='flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-4'>
                    <div className='flex items-center gap-2'>
                      <IconBadge tone='info' size='sm'><Users /></IconBadge>
                      <span className='text-sm font-semibold'>{t('Realtime user usage')}</span>
                    </div>
                    <div className='relative w-full sm:w-52'>
                      <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2' />
                      <Input aria-label={t('Search users')} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Search users')} className='h-7 pl-7 text-xs' />
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('Users')}</TableHead>
                        {(['requests', 'total_tokens', 'tpm', 'error_rate'] as const).map((key) => (
                          <TableHead key={key} className='text-right' aria-sort={sortAriaValue(sortKey, key, sortDirection)}>
                            <button type='button' aria-label={t('Sort by {{field}}', { field: t(SORT_LABEL_KEYS[key]) })} className='hover:text-foreground inline-flex items-center gap-1 text-right' onClick={() => toggleSort(key)}>
                              {t(SORT_LABEL_KEYS[key])}
                              {sortKey === key && (sortDirection === 'asc' ? <ArrowUp className='size-3' /> : <ArrowDown className='size-3' />)}
                            </button>
                          </TableHead>
                        ))}
                        <TableHead>{t('Last call')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.user_id} data-state={selectedUserId === user.user_id ? 'selected' : undefined}>
                          <TableCell>
                            <button type='button' aria-label={t('Select {{username}}', { username: user.username || `#${user.user_id}` })} aria-pressed={selectedUserId === user.user_id} className='flex items-center gap-2 text-left' onClick={() => setSelectedUserId(user.user_id)}>
                              <span className={cn('size-2 rounded-full', statusDotClass(user))} aria-hidden='true' />
                              <span className='max-w-40 truncate font-medium'>{user.username || `#${user.user_id}`}</span>
                              {selectedUserId === user.user_id && <Check className='text-primary size-3.5' />}
                            </button>
                          </TableCell>
                          <TableCell className='text-right font-mono'>{formatNumber(user.requests)}</TableCell>
                          <TableCell className='text-right font-mono'>{formatNumber(user.total_tokens)}</TableCell>
                          <TableCell className='text-right font-mono'>{formatNumber(user.tpm)}</TableCell>
                          <TableCell className={cn('text-right font-mono', errorRateClass(user.error_rate))}>{formatPercent(user.error_rate)}</TableCell>
                          <TableCell className='text-muted-foreground text-xs'>{formatTimestamp(user.last_call_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filteredUsers.length === 0 && <div className='text-muted-foreground px-4 py-8 text-center text-xs'>{t('No realtime usage data')}</div>}
                </div>

                <div className='overflow-hidden rounded-lg border'>
                  <div className='flex items-center gap-2 border-b px-3 py-2.5 sm:px-4'>
                    <IconBadge tone='success' size='sm'><Activity /></IconBadge>
                    <span className='text-sm font-semibold'>{trendTitle}</span>
                  </div>
                  <div className='h-[280px] p-1.5 sm:h-80 sm:p-2'>
                    {themeReady && trendSpec && <VChart key={`${resolvedTheme}-${selectedUserId ?? 'all'}`} spec={{ ...trendSpec, theme: resolvedTheme === 'dark' ? 'dark' : 'light' }} option={VCHART_OPTION} />}
                  </div>
                </div>
              </div>
            )}
          </>
        )
      )}
    </div>
  )
}
