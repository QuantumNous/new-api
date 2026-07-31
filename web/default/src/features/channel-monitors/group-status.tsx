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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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

import {
  getGroupStatus,
  GroupStatusTestCooldownError,
  runGroupStatusTest,
} from './api'
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
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const statusQuery = useQuery({
    queryKey: ['group-status'],
    queryFn: getGroupStatus,
    refetchInterval: 15_000,
  })

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      1000
    )
    return () => window.clearInterval(timer)
  }, [])

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
          <div className='bg-background flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <p className='font-medium'>{t('Availability period')}</p>
              <p className='text-muted-foreground mt-0.5 text-xs'>
                {period === '7'
                  ? t('Showing 7-day stability')
                  : t('Showing 30-day stability')}
              </p>
            </div>
            <ToggleGroup
              value={[period]}
              onValueChange={(values) => {
                const next = values[0]
                if (next === '7' || next === '30') setPeriod(next)
              }}
              className='bg-muted/60 grid w-full grid-cols-2 rounded-lg border p-1 sm:w-72'
              aria-label={t('Availability period')}
            >
              <ToggleGroupItem
                value='7'
                className='aria-pressed:bg-primary aria-pressed:text-primary-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-10 w-full px-3 text-center leading-tight whitespace-normal'
              >
                {period === '7' && (
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    data-icon='inline-start'
                  />
                )}
                {t('Last 7 days')}
              </ToggleGroupItem>
              <ToggleGroupItem
                value='30'
                className='aria-pressed:bg-primary aria-pressed:text-primary-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-10 w-full px-3 text-center leading-tight whitespace-normal'
              >
                {period === '30' && (
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    data-icon='inline-start'
                  />
                )}
                {t('Last 30 days')}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

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
                  now={now}
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
  now: number
}

function GroupStatusCard(props: GroupStatusCardProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const testMutation = useMutation({
    mutationFn: () => runGroupStatusTest(props.monitor.id),
    onSuccess: async (response) => {
      setCooldownUntil(response.next_test_at)
      await queryClient.invalidateQueries({ queryKey: ['group-status'] })
      if (response.result.success) {
        toast.success(t('Availability test succeeded'))
      } else {
        toast.error(t('Availability test failed'))
      }
    },
    onError: (error) => {
      if (error instanceof GroupStatusTestCooldownError) {
        setCooldownUntil(error.nextTestAt)
        toast.error(
          t('Test again in {{seconds}}s', {
            seconds: Math.max(1, error.nextTestAt - props.now),
          })
        )
        return
      }
      toast.error(error.message || t('Operation failed'))
    },
  })
  const availability =
    props.period === '7'
      ? props.monitor.availability_7d
      : props.monitor.availability_30d
  let statusLabel = t('Not tested')
  if (props.monitor.status === 'success') statusLabel = t('Operational')
  if (props.monitor.status === 'failed') statusLabel = t('Failed')
  const nextUserTestAt = Math.max(
    cooldownUntil,
    props.monitor.user_test_available_at ?? 0,
    testMutation.data?.next_test_at ?? 0
  )
  const retrySeconds = Math.max(0, nextUserTestAt - props.now)
  const userTestResult = testMutation.data?.result
  let footerStatus = statusLabel
  let footerStatusTone = ''
  if (props.monitor.status === 'failed') footerStatusTone = 'text-destructive'
  if (props.monitor.status === 'success') footerStatusTone = 'text-success'
  if (userTestResult) {
    footerStatus = userTestResult.success ? t('Operational') : t('Failed')
    if (userTestResult.latency_ms > 0) {
      footerStatus += ` · ${userTestResult.latency_ms} ms`
    }
    footerStatusTone = userTestResult.success
      ? 'text-success'
      : 'text-destructive'
  }
  let testButtonLabel = t('Run test now')
  let testButtonIcon = (
    <HugeiconsIcon icon={Activity01Icon} data-icon='inline-start' />
  )
  if (retrySeconds > 0) {
    testButtonLabel = t('Test again in {{seconds}}s', {
      seconds: retrySeconds,
    })
    testButtonIcon = <HugeiconsIcon icon={ClockIcon} data-icon='inline-start' />
  }
  if (testMutation.isPending) {
    testButtonLabel = t('Testing...')
    testButtonIcon = <Spinner data-icon='inline-start' />
  }

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
              {props.period === '7'
                ? t('7-day stability')
                : t('30-day stability')}
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
            <NextCheckCountdown
              value={props.monitor.next_check_at}
              now={props.now}
            />
          </div>
          <MonitorHistoryBars results={props.monitor.recent_results} />
          <div className='text-muted-foreground mt-1 flex justify-between text-[10px]'>
            <span>{t('Past')}</span>
            <span>{t('Now')}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className='flex-wrap justify-between gap-3 px-4 py-3 text-xs'>
        <div className='flex min-w-0 flex-col gap-0.5'>
          <span className='text-muted-foreground'>
            {userTestResult ? t('Just tested') : t('Current status')}
          </span>
          <span className={cn('font-medium', footerStatusTone)}>
            {footerStatus}
          </span>
        </div>
        <Button
          variant='outline'
          className='min-w-32'
          disabled={
            !props.monitor.can_test ||
            testMutation.isPending ||
            retrySeconds > 0
          }
          onClick={() => testMutation.mutate()}
        >
          {testButtonIcon}
          {testButtonLabel}
        </Button>
      </CardFooter>
    </Card>
  )
}

function NextCheckCountdown(props: { value: number | null; now: number }) {
  const { t } = useTranslation()

  if (props.value == null) {
    return <span className='text-muted-foreground'>--</span>
  }
  return (
    <span className='text-muted-foreground tabular-nums'>
      {t('Refresh in {{seconds}}s', {
        seconds: Math.max(0, props.value - props.now),
      })}
    </span>
  )
}
