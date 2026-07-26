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

import {
  Activity01Icon,
  Alert02Icon,
  ApiIcon,
  CheckmarkCircle02Icon,
  ClockIcon,
  RefreshIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { getGroupStatus } from './api'
import {
  MonitorHistoryBars,
  MonitorStatusBadge,
} from './components/monitor-status'
import {
  formatMonitorAvailability,
  formatMonitorTime,
  getMonitorApiHost,
} from './lib/format'
import type { GroupStatusMonitor } from './types'

type AvailabilityPeriod = '7' | '30'

export function GroupStatus() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<AvailabilityPeriod>('7')
  const statusQuery = useQuery({
    queryKey: ['group-status'],
    queryFn: getGroupStatus,
    refetchInterval: 15_000,
  })

  const monitors = statusQuery.data ?? []
  const operational = monitors.filter(
    (monitor) => monitor.status === 'success'
  ).length
  const failed = monitors.filter(
    (monitor) => monitor.status === 'failed'
  ).length

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Group Status')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <ToggleGroup
          value={[period]}
          onValueChange={(values) => {
            const next = values[0]
            if (next === '7' || next === '30') setPeriod(next)
          }}
          variant='outline'
          size='sm'
          aria-label={t('Availability period')}
        >
          <ToggleGroupItem value='7'>{t('7 days')}</ToggleGroupItem>
          <ToggleGroupItem value='30'>{t('30 days')}</ToggleGroupItem>
        </ToggleGroup>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='outline'
                size='icon'
                aria-label={t('Refresh')}
                onClick={() => void statusQuery.refetch()}
                disabled={statusQuery.isFetching}
              />
            }
          >
            {statusQuery.isFetching ? (
              <Spinner />
            ) : (
              <HugeiconsIcon icon={RefreshIcon} />
            )}
          </TooltipTrigger>
          <TooltipContent>{t('Refresh')}</TooltipContent>
        </Tooltip>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-7xl flex-col gap-4'>
          <div className='divide-border bg-background grid grid-cols-2 overflow-hidden rounded-lg border sm:grid-cols-4 sm:divide-x'>
            <StatusSummary
              label={t('Monitored groups')}
              value={monitors.length}
              icon={Activity01Icon}
            />
            <StatusSummary
              label={t('Operational')}
              value={operational}
              icon={CheckmarkCircle02Icon}
              tone='success'
            />
            <StatusSummary
              label={t('Failed')}
              value={failed}
              icon={Alert02Icon}
              tone='destructive'
            />
            <StatusSummary
              label={t('Last refreshed')}
              value={
                statusQuery.dataUpdatedAt
                  ? new Date(statusQuery.dataUpdatedAt).toLocaleTimeString()
                  : '--'
              }
              icon={ClockIcon}
            />
          </div>

          {statusQuery.isError && (
            <Alert variant='destructive'>
              <HugeiconsIcon icon={Alert02Icon} />
              <AlertTitle>{t('Failed to load group status')}</AlertTitle>
              <AlertDescription>{statusQuery.error.message}</AlertDescription>
            </Alert>
          )}

          {statusQuery.isLoading && (
            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className='h-80 w-full' />
              ))}
            </div>
          )}
          {!statusQuery.isLoading && monitors.length === 0 && (
            <Empty className='bg-background min-h-80 rounded-lg border'>
              <EmptyHeader>
                <EmptyMedia variant='icon'>
                  <HugeiconsIcon icon={Activity01Icon} />
                </EmptyMedia>
                <EmptyTitle>{t('No group status available')}</EmptyTitle>
                <EmptyDescription>
                  {t('No monitored pricing groups are currently visible')}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {!statusQuery.isLoading && monitors.length > 0 && (
            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
              {monitors.map((monitor) => (
                <GroupStatusCard
                  key={monitor.id}
                  monitor={monitor}
                  period={period}
                />
              ))}
            </div>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

type StatusSummaryProps = {
  label: string
  value: number | string
  icon: typeof Activity01Icon
  tone?: 'success' | 'destructive'
}

function StatusSummary(props: StatusSummaryProps) {
  return (
    <div className='flex min-h-20 items-center gap-3 px-4 py-3'>
      <div className='bg-muted grid size-9 shrink-0 place-items-center rounded-lg'>
        <HugeiconsIcon
          icon={props.icon}
          className={cn(
            'text-muted-foreground',
            props.tone === 'success' && 'text-success',
            props.tone === 'destructive' && 'text-destructive'
          )}
        />
      </div>
      <div className='min-w-0'>
        <p className='truncate text-base leading-none font-semibold tabular-nums'>
          {props.value}
        </p>
        <p className='text-muted-foreground mt-1 truncate text-xs'>
          {props.label}
        </p>
      </div>
    </div>
  )
}

type GroupStatusCardProps = {
  monitor: GroupStatusMonitor
  period: AvailabilityPeriod
}

function GroupStatusCard(props: GroupStatusCardProps) {
  const { t } = useTranslation()
  const availability =
    props.period === '7'
      ? props.monitor.availability_7d
      : props.monitor.availability_30d
  let statusLabel = t('Not tested')
  if (props.monitor.status === 'success') statusLabel = t('Operational')
  if (props.monitor.status === 'failed') statusLabel = t('Failed')

  return (
    <Card className='min-w-0 gap-0 py-0'>
      <CardHeader className='border-b px-4 py-4'>
        <CardTitle className='truncate'>{props.monitor.name}</CardTitle>
        <CardAction>
          <MonitorStatusBadge status={props.monitor.status} />
        </CardAction>
        <div className='text-muted-foreground col-span-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
          <span className='inline-flex min-w-0 items-center gap-1.5'>
            <HugeiconsIcon icon={ApiIcon} className='size-3.5 shrink-0' />
            <span className='truncate'>
              {getMonitorApiHost(props.monitor.api_url)}
            </span>
          </span>
          <code className='truncate'>{props.monitor.test_model}</code>
        </div>
      </CardHeader>

      <CardContent className='flex flex-col gap-5 px-4 py-4'>
        <div className='bg-muted/40 grid grid-cols-2 overflow-hidden rounded-lg border'>
          <div className='flex min-h-16 flex-col justify-center px-3'>
            <span className='text-muted-foreground text-xs'>
              {t('Request latency')}
            </span>
            <strong className='mt-1 text-lg font-semibold tabular-nums'>
              {props.monitor.latest_latency_ms == null
                ? '--'
                : `${props.monitor.latest_latency_ms} ms`}
            </strong>
          </div>
          <div className='flex min-h-16 flex-col justify-center border-s px-3'>
            <span className='text-muted-foreground text-xs'>
              {t('Test interval')}
            </span>
            <strong className='mt-1 text-lg font-semibold tabular-nums'>
              {props.monitor.interval_seconds} {t('seconds')}
            </strong>
          </div>
        </div>

        <div className='flex items-end justify-between gap-3'>
          <div>
            <p className='text-muted-foreground text-xs'>
              {t('Availability')} · {props.period} {t('days')}
            </p>
            <p className='text-muted-foreground mt-1 text-xs'>
              {formatMonitorTime(props.monitor.last_checked_at)}
            </p>
          </div>
          <strong
            className={cn(
              'text-3xl leading-none font-semibold tabular-nums',
              props.monitor.status === 'failed'
                ? 'text-destructive'
                : 'text-success'
            )}
          >
            {formatMonitorAvailability(availability)}
          </strong>
        </div>

        <div>
          <div className='mb-2 flex items-center justify-between gap-3 text-xs'>
            <span className='text-muted-foreground'>
              {t('Latest 30 test results')}
            </span>
            <NextCheckCountdown value={props.monitor.next_check_at} />
          </div>
          <MonitorHistoryBars results={props.monitor.recent_results} />
          <div className='text-muted-foreground mt-1 flex justify-between text-[10px]'>
            <span>{t('Past')}</span>
            <span>{t('Now')}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className='justify-between px-4 py-3 text-xs'>
        <span className='text-muted-foreground'>{t('Current status')}</span>
        <span
          className={cn(
            'font-medium',
            props.monitor.status === 'failed' && 'text-destructive',
            props.monitor.status === 'success' && 'text-success'
          )}
        >
          {statusLabel}
        </span>
      </CardFooter>
    </Card>
  )
}

function NextCheckCountdown(props: { value: number | null }) {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      1000
    )
    return () => window.clearInterval(timer)
  }, [])

  if (props.value == null) {
    return <span className='text-muted-foreground'>--</span>
  }
  return (
    <span className='text-muted-foreground tabular-nums'>
      {t('Refresh in {{seconds}}s', {
        seconds: Math.max(0, props.value - now),
      })}
    </span>
  )
}
