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
import { type KeyboardEvent, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import i18next from 'i18next'
import {
  Activity,
  type LucideIcon,
  MessageCircle,
  PauseCircle,
  Radio,
  RefreshCw,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { SectionPageLayout } from '@/components/layout'
import { StatusBadge } from '@/components/status-badge'
import {
  getUserChannelMonitorDetail,
  getUserChannelMonitorStatus,
} from '../api'
import {
  channelMonitorQueryKeys,
  formatAvailability,
  formatMonitorTime,
  getMonitorStatusLabel,
  getMonitorStatusVariant,
  getProviderLabel,
  groupUserMonitors,
  statusSegmentClassName,
} from '../lib'
import type {
  ChannelMonitorProvider,
  UserChannelMonitor,
  UserChannelMonitorModelDetail,
} from '../types'

const CHANNEL_STATUS_REFETCH_INTERVAL_MS = 60_000
const CHANNEL_STATUS_REFETCH_SECONDS = CHANNEL_STATUS_REFETCH_INTERVAL_MS / 1000
const TIMELINE_MAX_POINTS = 60
type AvailabilityWindowDays = 7 | 15 | 30

const availabilityWindowOptions: Array<{
  value: AvailabilityWindowDays
  label: string
}> = [
  { value: 7, label: '7d' },
  { value: 15, label: '15d' },
  { value: 30, label: '30d' },
]

const providerIconNames = {
  openai: 'OpenAI',
  anthropic: 'Claude',
  gemini: 'Gemini',
} satisfies Record<ChannelMonitorProvider, string>

export function ChannelStatusPage() {
  const { t } = useTranslation()
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [availabilityWindow, setAvailabilityWindow] =
    useState<AvailabilityWindowDays>(7)
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(
    CHANNEL_STATUS_REFETCH_SECONDS
  )
  const [selectedMonitorId, setSelectedMonitorId] = useState<number | null>(
    null
  )

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: channelMonitorQueryKeys.userStatus,
    queryFn: async () => {
      const result = await getUserChannelMonitorStatus()
      if (!result.success) {
        toast.error(
          result.message || i18next.t('Failed to load channel status')
        )
        return null
      }
      return result.data ?? null
    },
  })

  useEffect(() => {
    if (!autoRefresh) return
    const timer = window.setInterval(() => {
      setSecondsUntilRefresh((previous) => Math.max(previous - 1, 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [autoRefresh])

  useEffect(() => {
    if (!autoRefresh || secondsUntilRefresh > 0 || isFetching) return
    void refetch().finally(() =>
      setSecondsUntilRefresh(CHANNEL_STATUS_REFETCH_SECONDS)
    )
  }, [autoRefresh, isFetching, refetch, secondsUntilRefresh])

  const grouped = useMemo(
    () => groupUserMonitors(data?.monitors ?? []),
    [data?.monitors]
  )
  const overallStatus = data?.enabled
    ? data.summary.overall_state
    : data
      ? 'disabled'
      : 'unknown'

  const handleRefresh = () => {
    void refetch().finally(() =>
      setSecondsUntilRefresh(CHANNEL_STATUS_REFETCH_SECONDS)
    )
  }

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Channel Status')}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <ChannelStatusToolbar
            availabilityWindow={availabilityWindow}
            overallStatus={overallStatus}
            autoRefresh={autoRefresh}
            secondsUntilRefresh={secondsUntilRefresh}
            isFetching={isFetching}
            onAvailabilityWindowChange={setAvailabilityWindow}
            onRefresh={handleRefresh}
            onAutoRefreshChange={setAutoRefresh}
          />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='flex flex-col gap-4'>
            {data && !data.enabled && (
              <Alert>
                <PauseCircle />
                <AlertTitle>{t('Channel monitoring is disabled')}</AlertTitle>
                <AlertDescription>
                  {t('Status data is hidden while monitoring is disabled.')}
                </AlertDescription>
              </Alert>
            )}

            {isLoading ? (
              <ChannelStatusSkeleton />
            ) : data?.enabled && data.monitors.length === 0 ? (
              <Empty className='rounded-lg border py-12'>
                <EmptyHeader>
                  <EmptyMedia variant='icon'>
                    <Activity />
                  </EmptyMedia>
                  <EmptyTitle>{t('No Channel Monitors Found')}</EmptyTitle>
                  <EmptyDescription>
                    {t('No enabled monitors are available yet.')}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              Object.entries(grouped).map(([group, monitors]) => (
                <section key={group} className='flex flex-col gap-2'>
                  <div className='grid gap-4 sm:grid-cols-[repeat(auto-fill,minmax(28rem,28rem))]'>
                    {monitors.map((monitor) => (
                      <MonitorStatusCard
                        key={monitor.id}
                        monitor={monitor}
                        availabilityWindow={availabilityWindow}
                        autoRefresh={autoRefresh}
                        secondsUntilRefresh={secondsUntilRefresh}
                        onOpenDetail={() => setSelectedMonitorId(monitor.id)}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <MonitorDetailDialog
        monitorId={selectedMonitorId}
        onOpenChange={(open) => !open && setSelectedMonitorId(null)}
      />
    </>
  )
}

function ChannelStatusToolbar({
  availabilityWindow,
  overallStatus,
  autoRefresh,
  secondsUntilRefresh,
  isFetching,
  onAvailabilityWindowChange,
  onRefresh,
  onAutoRefreshChange,
}: {
  availabilityWindow: AvailabilityWindowDays
  overallStatus: string
  autoRefresh: boolean
  secondsUntilRefresh: number
  isFetching: boolean
  onAvailabilityWindowChange: (value: AvailabilityWindowDays) => void
  onRefresh: () => void
  onAutoRefreshChange: (value: boolean) => void
}) {
  const { t } = useTranslation()
  const [refreshAnimating, setRefreshAnimating] = useState(false)

  useEffect(() => {
    if (!refreshAnimating) return
    const timer = window.setTimeout(() => setRefreshAnimating(false), 700)
    return () => window.clearTimeout(timer)
  }, [refreshAnimating])

  const handleRefreshClick = () => {
    setRefreshAnimating(true)
    onRefresh()
  }

  return (
    <div className='bg-background flex flex-wrap items-center gap-2 rounded-xl border p-1 shadow-xs'>
      <ToggleGroup
        value={[String(availabilityWindow)]}
        onValueChange={(values) => {
          const value = Number(values[0])
          if (value === 7 || value === 15 || value === 30) {
            onAvailabilityWindowChange(value)
          }
        }}
        className='bg-muted/50 rounded-lg p-0.5'
        size='sm'
      >
        {availabilityWindowOptions.map((item) => (
          <ToggleGroupItem
            key={item.value}
            value={String(item.value)}
            className='px-3 text-xs'
          >
            {t(item.label)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <StatusBadge
        label={t(getMonitorStatusLabel(overallStatus)).toUpperCase()}
        variant={getMonitorStatusVariant(overallStatus)}
        showDot
        copyable={false}
        className='h-7 rounded-lg px-3 text-[11px] font-semibold'
      />

      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        onClick={handleRefreshClick}
        disabled={isFetching}
      >
        <RefreshCw
          data-icon='inline-start'
          className={cn((isFetching || refreshAnimating) && 'animate-spin')}
        />
        <span className='sr-only'>{t('Refresh')}</span>
      </Button>

      <Button
        type='button'
        variant={autoRefresh ? 'secondary' : 'outline'}
        size='sm'
        className='h-7 rounded-lg text-xs'
        onClick={() => onAutoRefreshChange(!autoRefresh)}
      >
        {autoRefresh
          ? t('Auto refresh: {{seconds}}s', {
              seconds: secondsUntilRefresh,
            })
          : t('Auto refresh paused')}
      </Button>
    </div>
  )
}

function MonitorStatusCard({
  monitor,
  availabilityWindow,
  autoRefresh,
  secondsUntilRefresh,
  onOpenDetail,
}: {
  monitor: UserChannelMonitor
  availabilityWindow: AvailabilityWindowDays
  autoRefresh: boolean
  secondsUntilRefresh: number
  onOpenDetail: () => void
}) {
  const { t } = useTranslation()
  const availability = formatAvailabilityParts(
    getMonitorAvailability(monitor, availabilityWindow)
  )
  const refreshLabel = autoRefresh
    ? t('Refreshes in {{seconds}}s', {
        seconds: secondsUntilRefresh,
      })
    : t('Auto refresh paused')
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onOpenDetail()
  }

  return (
    <Card
      role='button'
      tabIndex={0}
      aria-label={t('Open monitor details')}
      className='focus-visible:ring-ring w-full cursor-pointer overflow-hidden transition-shadow outline-none hover:shadow-md focus-visible:ring-[3px] sm:w-[28rem]'
      onClick={onOpenDetail}
      onKeyDown={handleKeyDown}
    >
      <CardHeader className='gap-0 pb-0'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-3'>
            <ProviderAvatar provider={monitor.provider} />
            <div className='min-w-0'>
              <CardTitle className='truncate text-base'>
                {monitor.name}
              </CardTitle>
              <CardDescription className='mt-1 flex min-w-0 items-center gap-1.5'>
                <Badge
                  variant='secondary'
                  className={cn(
                    'h-5 shrink-0 rounded-md px-1.5',
                    providerBadgeClassName(monitor.provider)
                  )}
                >
                  {t(getProviderLabel(monitor.provider))}
                </Badge>
                <span className='truncate'>{monitor.primary_model}</span>
              </CardDescription>
            </div>
          </div>
          <MonitorStatusPill status={monitor.primary_status} />
        </div>
      </CardHeader>
      <CardContent className='flex flex-col gap-4'>
        <div className='grid grid-cols-2 gap-2'>
          <LatencyMetricCell
            icon={MessageCircle}
            label={t('Conversation latency')}
            value={monitor.primary_latency_ms}
          />
          <LatencyMetricCell
            icon={Radio}
            label={t('Endpoint PING')}
            value={monitor.primary_ping_latency_ms}
          />
        </div>

        <Separator />

        <div className='flex items-end justify-between gap-3'>
          <span className='text-muted-foreground text-xs'>
            {t('Availability')} ·{' '}
            {t(getAvailabilityWindowLabel(availabilityWindow))}
          </span>
          <div
            className={cn(
              'flex items-baseline gap-1 text-3xl font-semibold tabular-nums',
              statusTextClassName(monitor.primary_status)
            )}
          >
            <span>{availability.value}</span>
            {availability.unit && (
              <span className='text-base font-semibold'>
                {availability.unit}
              </span>
            )}
          </div>
        </div>

        <div className='flex flex-col gap-1.5'>
          <div className='flex items-center justify-between gap-3'>
            <span className='text-muted-foreground truncate text-xs'>
              {t('Last {{count}} records', { count: TIMELINE_MAX_POINTS })}
            </span>
            <span
              className='text-muted-foreground truncate text-xs'
              title={`${t('Last checked')}: ${formatMonitorTime(
                monitor.last_checked_at
              )}`}
            >
              {refreshLabel}
            </span>
          </div>
          <Timeline points={monitor.timeline} />
          <div className='text-muted-foreground/80 flex items-center justify-between text-[10px] uppercase'>
            <span>{t('Past')}</span>
            <span>{t('Now')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ProviderAvatar({ provider }: { provider: ChannelMonitorProvider }) {
  return (
    <Avatar size='lg' className='rounded-lg'>
      <AvatarFallback
        className={cn('rounded-lg', providerAvatarClassName(provider))}
      >
        {getLobeIcon(`${providerIconNames[provider]}.Color`, 20)}
      </AvatarFallback>
    </Avatar>
  )
}

function MonitorStatusPill({ status }: { status: string }) {
  const { t } = useTranslation()
  return (
    <Badge
      variant='secondary'
      className={cn('shrink-0 rounded-md px-2', statusPillClassName(status))}
    >
      {t(getMonitorStatusLabel(status))}
    </Badge>
  )
}

function LatencyMetricCell({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value?: number | null
}) {
  const parts = formatLatencyParts(value)
  return (
    <div className='bg-muted/30 min-w-0 rounded-lg border px-4 py-3'>
      <div className='text-muted-foreground flex items-center gap-1.5 text-xs'>
        <Icon className='size-3.5 shrink-0' aria-hidden='true' />
        <span className='truncate'>{label}</span>
      </div>
      <div className='mt-2 flex min-w-0 items-baseline gap-1'>
        <span className='truncate text-xl font-semibold tabular-nums'>
          {parts.value}
        </span>
        {parts.unit && (
          <span className='text-muted-foreground text-xs font-medium'>
            {parts.unit}
          </span>
        )}
      </div>
    </div>
  )
}

function Timeline({ points }: { points: UserChannelMonitor['timeline'] }) {
  const { t } = useTranslation()
  const display = points.slice(0, TIMELINE_MAX_POINTS).reverse()
  const emptySlots = Math.max(TIMELINE_MAX_POINTS - display.length, 0)

  return (
    <div
      className='flex h-5 min-w-0 items-end gap-0.5 overflow-hidden'
      aria-label={t('Last {{count}} records', { count: TIMELINE_MAX_POINTS })}
    >
      {Array.from({ length: emptySlots }).map((_, index) => (
        <span
          key={`empty-${index}`}
          className='bg-muted min-w-1 flex-1 rounded-full'
          style={{ height: 6 }}
          aria-hidden='true'
        />
      ))}
      {display.map((point) => (
        <span
          key={`${point.checked_at}-${point.status}`}
          className={cn(
            'min-w-1 flex-1 rounded-full',
            statusSegmentClassName(point.status)
          )}
          style={{ height: getTimelineBarHeight(point) }}
          title={`${t(getMonitorStatusLabel(point.status))} · ${formatMonitorTime(point.checked_at)}`}
        />
      ))}
    </div>
  )
}

function formatLatencyParts(value?: number | null) {
  if (value == null || Number.isNaN(value)) return { value: '-', unit: '' }
  if (value < 1000) return { value: String(Math.round(value)), unit: 'ms' }
  return { value: (value / 1000).toFixed(2), unit: 's' }
}

function formatAvailabilityParts(value?: number | null) {
  const formatted = formatAvailability(value)
  if (formatted === '-') return { value: '-', unit: '' }
  return { value: formatted.replace('%', ''), unit: '%' }
}

function getAvailabilityWindowLabel(days: AvailabilityWindowDays) {
  switch (days) {
    case 15:
      return '15d'
    case 30:
      return '30d'
    default:
      return '7d'
  }
}

function getMonitorAvailability(
  monitor: UserChannelMonitor,
  days: AvailabilityWindowDays
) {
  switch (days) {
    case 15:
      return monitor.availability_15d
    case 30:
      return monitor.availability_30d
    default:
      return monitor.availability_7d
  }
}

function getTimelineBarHeight(point: UserChannelMonitor['timeline'][number]) {
  if (point.status === 'failed' || point.status === 'error') return 7
  if (point.status === 'degraded') return 18

  const latency = point.latency_ms ?? point.ping_latency_ms
  if (latency == null || Number.isNaN(latency)) return 13

  const normalized = Math.min(Math.max(latency / 1200, 0), 1)
  return Math.round(10 + normalized * 10)
}

function providerAvatarClassName(provider: ChannelMonitorProvider) {
  switch (provider) {
    case 'openai':
      return 'bg-success/10 text-success'
    case 'anthropic':
      return 'bg-warning/10 text-warning'
    case 'gemini':
      return 'bg-info/10 text-info'
  }
}

function providerBadgeClassName(provider: ChannelMonitorProvider) {
  switch (provider) {
    case 'openai':
      return 'bg-success/10 text-success'
    case 'anthropic':
      return 'bg-warning/10 text-warning'
    case 'gemini':
      return 'bg-info/10 text-info'
  }
}

function statusPillClassName(status: string) {
  switch (status) {
    case 'operational':
      return 'bg-success/10 text-success'
    case 'degraded':
      return 'bg-warning/10 text-warning'
    case 'failed':
    case 'error':
      return 'bg-destructive/10 text-destructive'
    case 'disabled':
    case 'unknown':
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function statusTextClassName(status: string) {
  switch (status) {
    case 'operational':
      return 'text-success'
    case 'degraded':
      return 'text-warning'
    case 'failed':
    case 'error':
      return 'text-destructive'
    default:
      return 'text-muted-foreground'
  }
}

function MonitorDetailDialog({
  monitorId,
  onOpenChange,
}: {
  monitorId: number | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: monitorId
      ? channelMonitorQueryKeys.userDetail(monitorId)
      : channelMonitorQueryKeys.userDetail(0),
    queryFn: async () => {
      if (!monitorId) return null
      const result = await getUserChannelMonitorDetail(monitorId)
      if (!result.success) {
        toast.error(
          result.message || i18next.t('Failed to load monitor detail')
        )
        return null
      }
      return result.data ?? null
    },
    enabled: Boolean(monitorId),
  })

  return (
    <Dialog open={Boolean(monitorId)} onOpenChange={onOpenChange}>
      <DialogContent className='gap-0 overflow-hidden p-0 sm:max-w-4xl'>
        <DialogHeader className='px-6 py-5 pr-12'>
          <DialogTitle className='truncate text-lg font-semibold'>
            {data?.monitor.name ?? t('Monitor Detail')}
          </DialogTitle>
        </DialogHeader>

        <div className='max-h-[60vh] overflow-auto px-6 pb-4'>
          {isLoading ? (
            <MonitorDetailTableSkeleton />
          ) : (data?.monitor.models ?? []).length === 0 ? (
            <Empty className='py-10'>
              <EmptyHeader>
                <EmptyMedia variant='icon'>
                  <Activity />
                </EmptyMedia>
                <EmptyTitle>{t('No history records yet.')}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Model')}</TableHead>
                  <TableHead>{t('Latest Status')}</TableHead>
                  <TableHead>{t('Latest Latency (MS)')}</TableHead>
                  <TableHead>{t('7d Availability')}</TableHead>
                  <TableHead>{t('15d Availability')}</TableHead>
                  <TableHead>{t('30d Availability')}</TableHead>
                  <TableHead>{t('7d Avg Latency (MS)')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.monitor.models ?? []).map((model) => (
                  <ModelDetailTableRow key={model.model} model={model} />
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter className='bg-background mx-0 mb-0 px-6 py-4'>
          <DialogClose render={<Button variant='outline' />}>
            {t('Close')}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MonitorDetailTableSkeleton() {
  return (
    <div className='flex flex-col gap-3'>
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className='h-10 w-full rounded-md' />
      ))}
    </div>
  )
}

function ModelDetailTableRow({
  model,
}: {
  model: UserChannelMonitorModelDetail
}) {
  return (
    <TableRow>
      <TableCell className='font-medium'>{model.model}</TableCell>
      <TableCell>
        <MonitorStatusPill status={model.latest_status} />
      </TableCell>
      <TableCell>{formatMilliseconds(model.latest_latency_ms)}</TableCell>
      <TableCell>{formatAvailability(model.availability_7d)}</TableCell>
      <TableCell>{formatAvailability(model.availability_15d)}</TableCell>
      <TableCell>{formatAvailability(model.availability_30d)}</TableCell>
      <TableCell>{formatMilliseconds(model.avg_latency_7d_ms)}</TableCell>
    </TableRow>
  )
}

function formatMilliseconds(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '-'
  return String(Math.round(value))
}

function ChannelStatusSkeleton() {
  return (
    <div className='grid gap-4 sm:grid-cols-[repeat(auto-fill,minmax(28rem,28rem))]'>
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index} className='w-full sm:w-[28rem]'>
          <CardHeader className='gap-0 pb-0'>
            <div className='flex items-start justify-between gap-3'>
              <div className='flex min-w-0 items-center gap-3'>
                <Skeleton className='size-10 rounded-lg' />
                <div className='flex min-w-0 flex-col gap-2'>
                  <Skeleton className='h-5 w-36' />
                  <Skeleton className='h-4 w-48' />
                </div>
              </div>
              <Skeleton className='h-5 w-14 rounded-md' />
            </div>
          </CardHeader>
          <CardContent className='flex flex-col gap-4'>
            <div className='grid grid-cols-2 gap-2'>
              <Skeleton className='h-[74px] w-full rounded-lg' />
              <Skeleton className='h-[74px] w-full rounded-lg' />
            </div>
            <Separator />
            <div className='flex items-end justify-between gap-3'>
              <Skeleton className='h-4 w-24' />
              <Skeleton className='h-9 w-28' />
            </div>
            <div className='flex flex-col gap-1.5'>
              <div className='flex items-center justify-between gap-3'>
                <Skeleton className='h-4 w-28' />
                <Skeleton className='h-4 w-20' />
              </div>
              <Skeleton className='h-5 w-full rounded-md' />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
