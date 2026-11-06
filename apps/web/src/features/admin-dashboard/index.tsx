import { useQuery } from '@tanstack/react-query'
import { VChart } from '@visactor/react-vchart'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Gauge,
  RadioTower,
  RefreshCw,
  Server,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ChartErrorBoundary } from '@/components/ui/chart-error-boundary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getFlowQuotaDates, getUptimeStatus, getUserQuotaDataByUsers, getUserQuotaDates } from '@/features/dashboard/api'
import type { FlowQuotaDataItem, QuotaDataItem, UptimeGroupResult } from '@/features/dashboard/types'
import { getPerfMetrics, getPerfMetricsSummary } from '@/features/performance-metrics/api'
import { formatLatencyWithUnit, pickLatencyUnit } from '@/features/performance-metrics/lib/format'
import type { PerfModelSummary, PerformanceSeriesPoint } from '@/features/performance-metrics/types'
import { formatCompactNumber, formatNumber, formatPercent, formatQuota } from '@/lib/format'
import { computeTimeRange } from '@/lib/time'

const RANGE_OPTIONS = [1, 3, 7, 30] as const

type Metric = { label: string; value: string; unit: string; icon: LucideIcon; tone: IconBadgeTone }

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function StateMessage({ error, empty }: { error?: boolean; empty?: boolean }) {
  const { t } = useTranslation()
  if (error) return <p className='text-muted-foreground p-4 text-sm'>{t('admin.dashboard.unableToLoad')}</p>
  if (empty) return <Empty className='min-h-28 border-0'><EmptyHeader><EmptyTitle>{t('admin.dashboard.noData')}</EmptyTitle><EmptyDescription>{t('admin.dashboard.noActivity')}</EmptyDescription></EmptyHeader></Empty>
  return null
}

function MetricCard({ metric, loading }: { metric: Metric; loading: boolean }) {
  const Icon = metric.icon
  return <Card className='min-w-0 gap-2 py-3'><CardContent className='px-3 sm:px-4'><div className='flex items-center gap-2'><IconBadge tone={metric.tone} size='sm'><Icon /></IconBadge><span className='text-muted-foreground truncate text-xs font-medium'>{metric.label}</span></div>{loading ? <Skeleton className='mt-3 h-7 w-24' /> : <div className='mt-2 truncate font-mono text-xl font-semibold tabular-nums'>{metric.value} <span className='text-muted-foreground text-xs font-normal'>{metric.unit}</span></div>}</CardContent></Card>
}

function Panel({ title, icon: Icon, action, children }: { title: string; icon: LucideIcon; action?: React.ReactNode; children: React.ReactNode }) {
  return <Card className='min-w-0 gap-0 py-0'><CardHeader className='border-b px-4 py-3'><CardTitle className='flex items-center justify-between gap-2 text-sm'><span className='flex items-center gap-2'><IconBadge tone='info' size='sm'><Icon /></IconBadge>{title}</span>{action}</CardTitle></CardHeader><CardContent className='p-0'>{children}</CardContent></Card>
}

function buildTrendSpec(series: PerformanceSeriesPoint[], reducedMotion: boolean) {
  return { type: 'line', data: [{ id: 'performance', values: series.map((point) => ({ time: new Date(point.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), value: point.success_rate })) }], xField: 'time', yField: 'value', axes: [ { orient: 'bottom', type: 'band', visible: true }, { orient: 'left', type: 'linear', visible: true, title: { visible: true, text: '%' } } ], legends: { visible: false }, point: { visible: false }, line: { style: { curveType: 'monotone', lineWidth: 2 } }, animation: !reducedMotion, padding: { top: 8, right: 16, bottom: 24, left: 38 } }
}

function AdminDashboard() {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const [days, setDays] = useState<(typeof RANGE_OPTIONS)[number]>(7)
  const range = useMemo(() => computeTimeRange(days), [days])
  const params = useMemo(() => ({ ...range }), [range])
  const rpmParams = params
  const usageQuery = useQuery({ queryKey: ['admin-dashboard', 'usage', days], queryFn: () => getUserQuotaDates(params, true), staleTime: 60_000 })
  const rpmQuery = useQuery({ queryKey: ['admin-dashboard', 'rpm-tpm', days], queryFn: () => getUserQuotaDates(rpmParams, true), staleTime: 60_000 })
  const flowQuery = useQuery({ queryKey: ['admin-dashboard', 'flow', days], queryFn: () => getFlowQuotaDates(params, true), staleTime: 60_000 })
  const usersQuery = useQuery({ queryKey: ['admin-dashboard', 'users', days], queryFn: () => getUserQuotaDataByUsers(params), staleTime: 60_000 })
  const performanceQuery = useQuery({ queryKey: ['admin-dashboard', 'performance', days], queryFn: () => getPerfMetricsSummary(days * 24), staleTime: 60_000, retry: false })
  const uptimeQuery = useQuery({ queryKey: ['admin-dashboard', 'uptime'], queryFn: getUptimeStatus, staleTime: 60_000, retry: false })

  const usage = usageQuery.data?.data ?? []
  const flow = flowQuery.data?.data ?? []
  const users = usersQuery.data?.data ?? []
  const models = Array.isArray(performanceQuery.data?.data?.models) ? performanceQuery.data.data.models : []
  const topModel = models[0]?.model_name ?? ''
  const trendQuery = useQuery({ queryKey: ['admin-dashboard', 'trend', topModel, days], queryFn: () => getPerfMetrics(topModel, Math.min(days * 24, 24 * 30)), enabled: Boolean(topModel), staleTime: 60_000, retry: false })

  const totals = useMemo(() => usage.reduce((result, item: QuotaDataItem) => { result.requests += numberValue(item.count); result.consumption += numberValue(item.quota_display); result.tokens += numberValue(item.token_used); if (item.user_id || item.username) result.users.add(item.user_id ?? item.username ?? 0); return result }, { requests: 0, consumption: 0, tokens: 0, users: new Set<number | string>() }), [usage])
  const rankings = useMemo(() => {
    const aggregate = (rows: Array<QuotaDataItem | FlowQuotaDataItem>, key: (row: QuotaDataItem | FlowQuotaDataItem) => string) => { const map = new Map<string, { requests: number; tokens: number; consumption: number }>(); rows.forEach((row) => { const name = key(row) || t('admin.dashboard.unknown'); const item = map.get(name) ?? { requests: 0, tokens: 0, consumption: 0 }; item.requests += numberValue(row.count); item.tokens += numberValue(row.token_used); item.consumption += numberValue(row.quota_display); map.set(name, item) }); return [...map.entries()].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.requests - a.requests).slice(0, 6) }
    const channels = aggregate(flow, (row) => { const item = row as FlowQuotaDataItem; return item.channel_name ?? (item.channel_id ? `Channel ${item.channel_id}` : '') })
    return { models: aggregate(usage, (row) => row.model_name ?? ''), channels, users: users.map((row) => ({ name: row.username ?? String(row.user_id ?? t('admin.dashboard.unknown')), requests: numberValue(row.count), tokens: numberValue(row.token_used), consumption: numberValue(row.quota_display) })).sort((a, b) => b.requests - a.requests).slice(0, 6) }
  }, [flow, t, usage, users])
  const rpmTpm = useMemo(() => { const buckets = new Map<number, { requests: number; tokens: number }>(); (rpmQuery.data?.data ?? []).forEach((row) => { const bucket = Math.floor(numberValue(row.created_at) / 3600) * 3600; const item = buckets.get(bucket) ?? { requests: 0, tokens: 0 }; item.requests += numberValue(row.count); item.tokens += numberValue(row.token_used); buckets.set(bucket, item) }); return [...buckets.entries()].sort((a, b) => a[0] - b[0]).slice(-72).map(([ts, value]) => ({ time: new Date(ts * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' }), rpm: value.requests / 60, tpm: value.tokens / 60 })) }, [rpmQuery.data])
  const userActivity = useMemo(() => {
    const midpoint = range.start_timestamp + (range.end_timestamp - range.start_timestamp) / 2
    const current = new Set<string | number>()
    const previous = new Set<string | number>()
    users.forEach((row) => {
      const identity = row.user_id ?? row.username
      if (identity === undefined) return
      if (numberValue(row.created_at) >= midpoint) current.add(identity)
      else previous.add(identity)
    })
    const growth = previous.size ? ((current.size - previous.size) / previous.size) * 100 : current.size ? 100 : 0
    return { growth, index: totals.users.size ? totals.requests / totals.users.size : 0 }
  }, [range, totals.requests, totals.users.size, users])
  const anomalyModels = models.filter((model: PerfModelSummary) => (Number(model.success_rate) || 0) < 95 || (Number(model.avg_latency_ms) || 0) > 2000).slice(0, 5)
  // The anomaly list compares models side by side, so its latency column
  // keeps one unit picked from the slowest entry rather than flipping between
  // milliseconds and seconds row by row.
  const anomalyLatencyUnit = pickLatencyUnit(
    Math.max(0, ...anomalyModels.map((model) => Number(model.avg_latency_ms) || 0))
  )
  const uptime = (Array.isArray(uptimeQuery.data?.data) ? uptimeQuery.data.data : []).filter(Boolean) as UptimeGroupResult[]
  const trendSeries = trendQuery.data?.data?.groups?.[0]?.series
  const serviceCount = uptime.reduce((sum, group) => sum + (group.monitors?.length ?? 0), 0)
  const healthyServices = uptime.reduce((sum, group) => sum + (group.monitors?.filter((monitor) => monitor.status === 1).length ?? 0), 0)
  const metrics: Metric[] = [{ label: t('admin.dashboard.platformRequests'), value: formatCompactNumber(totals.requests), unit: t('admin.dashboard.requests'), icon: Activity, tone: 'info' }, { label: t('admin.dashboard.consumption'), value: formatQuota(totals.consumption), unit: t('admin.dashboard.quota'), icon: BarChart3, tone: 'warning' }, { label: t('admin.dashboard.tokens'), value: formatCompactNumber(totals.tokens), unit: t('admin.dashboard.tokensUnit'), icon: Gauge, tone: 'info' }, { label: t('admin.dashboard.activeUsers'), value: formatNumber(totals.users.size), unit: t('admin.dashboard.users'), icon: Users, tone: 'success' }]
  const loading = usageQuery.isLoading || flowQuery.isLoading || usersQuery.isLoading
  const refresh = () => void Promise.all([usageQuery.refetch(), rpmQuery.refetch(), flowQuery.refetch(), usersQuery.refetch(), performanceQuery.refetch(), uptimeQuery.refetch(), trendQuery.refetch()])

  return <div className='space-y-4'>
    <div className='flex flex-wrap items-start justify-between gap-3'><div><h1 className='text-2xl font-semibold tracking-tight'>{t('admin.dashboard.title')}</h1><p className='text-muted-foreground mt-1 text-sm'>{t('admin.dashboard.subtitle')}</p></div><div className='flex items-center gap-2'><div className='bg-muted flex rounded-md p-1'>{RANGE_OPTIONS.map((option) => <Button key={option} variant={days === option ? 'secondary' : 'ghost'} size='sm' onClick={() => setDays(option)}>{option} {t('admin.dashboard.days')}</Button>)}</div><Button variant='outline' size='icon' onClick={refresh} disabled={loading} aria-label={t('admin.dashboard.refresh')}><motion.span
          animate={loading && !reducedMotion ? { rotate: 360 } : { rotate: 0 }}
          transition={loading ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : { duration: 0.15 }}
          className='inline-flex'
        >
          <RefreshCw />
        </motion.span></Button></div></div>
    <div className='grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4'>{metrics.map((metric) => <MetricCard key={metric.label} metric={metric} loading={loading} />)}</div>
    <div className='grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,1fr)]'><Panel title={t('admin.dashboard.businessTrend')} icon={Gauge}>{trendQuery.isLoading ? <Skeleton className='m-4 h-64' /> : trendQuery.isError ? <StateMessage error /> : Array.isArray(trendSeries) && trendSeries.length ? <div className='h-64 p-2'><ChartErrorBoundary key={`${topModel}-${days}-${trendSeries.length}`} fallback={<StateMessage error />}><VChart spec={buildTrendSpec(trendSeries, Boolean(reducedMotion))} /></ChartErrorBoundary></div> : <StateMessage empty />}</Panel><Panel title={t('admin.dashboard.serviceStatus')} icon={Server}>{uptimeQuery.isLoading ? <Skeleton className='m-4 h-32' /> : uptimeQuery.isError ? <StateMessage error /> : serviceCount ? <div className='p-4 text-sm'><div className='flex justify-between'><span>{t('admin.dashboard.healthyServices')}</span><span className='font-mono'>{healthyServices}/{serviceCount}</span></div><div className='mt-3 space-y-2'>{uptime.flatMap((group) => group.monitors ?? []).slice(0, 5).map((monitor) => <div className='flex justify-between gap-3' key={monitor.name}><span className='truncate'>{monitor.name}</span><span className={monitor.status === 1 ? 'text-success' : 'text-warning'}>{monitor.status === 1 ? t('admin.dashboard.healthy') : t('admin.dashboard.degraded')}</span></div>)}</div></div> : <StateMessage empty />}</Panel></div>
    <Panel title={t('admin.dashboard.requestsTokensPeriod')} icon={Activity}>{rpmTpm.length ? <div className='grid gap-2 p-4 sm:grid-cols-2'>{rpmTpm.slice(-6).map((point) => <div className='bg-muted/35 rounded-md border px-3 py-2 text-xs' key={point.time}><div className='text-muted-foreground'>{point.time}</div><div className='mt-1 font-mono'>RPM {formatNumber(point.rpm)} · TPM {formatCompactNumber(point.tpm)}</div></div>)}</div> : <StateMessage empty />}</Panel>
    <Panel title={t('admin.dashboard.userGrowthActivity')} icon={Users}><div className='grid gap-3 p-4 sm:grid-cols-2'><div><div className='text-muted-foreground text-xs'>{t('admin.dashboard.userGrowth')}</div><div className='mt-1 font-mono text-lg'>{formatPercent(userActivity.growth)}</div></div><div><div className='text-muted-foreground text-xs'>{t('admin.dashboard.activityIndex')}</div><div className='mt-1 font-mono text-lg'>{formatNumber(userActivity.index)} {t('admin.dashboard.requestsPerActiveUser')}</div></div></div></Panel>
    <div className='grid min-w-0 gap-4 lg:grid-cols-3'>{[ ['admin.dashboard.topModels', rankings.models], ['admin.dashboard.topChannels', rankings.channels], ['admin.dashboard.topUsers', rankings.users]].map(([title, rows]) => <Panel key={title as string} title={t(title as string)} icon={title === 'admin.dashboard.topChannels' ? RadioTower : Users}>{(rows as Array<{ name: string; requests: number; tokens: number; consumption: number }>).length ? <div className='divide-y'>{(rows as Array<{ name: string; requests: number; tokens: number; consumption: number }>).map((row, index) => <div className='flex items-center justify-between gap-3 px-4 py-2.5 text-xs' key={`${row.name}-${index}`}><span className='truncate'>{row.name}</span><span className='shrink-0 font-mono'>{formatCompactNumber(row.requests)} {t('admin.dashboard.requests')}</span></div>)}</div> : <StateMessage empty />}</Panel>)}</div>
    <Panel title={t('admin.dashboard.performanceAnomalies')} icon={AlertTriangle}>{performanceQuery.isLoading ? <Skeleton className='m-4 h-24' /> : performanceQuery.isError ? <StateMessage error /> : anomalyModels.length ? <div className='divide-y'>{anomalyModels.map((model) => <div className='flex justify-between gap-3 px-4 py-2.5 text-xs' key={model.model_name}><span className='truncate font-mono'>{model.model_name}</span><span className='shrink-0 text-warning'>{formatPercent(model.success_rate)} · {formatLatencyWithUnit(model.avg_latency_ms, anomalyLatencyUnit)}</span></div>)}</div> : <StateMessage empty />}</Panel>
    <Card><CardContent className='p-4 text-sm'><strong>{t('admin.dashboard.orders')}</strong><p className='text-muted-foreground mt-1'>{t('admin.dashboard.ordersUnavailable')}</p></CardContent></Card>
    {(usageQuery.isError || flowQuery.isError || usersQuery.isError) && <Card><CardContent><StateMessage error /></CardContent></Card>}
  </div>
}

export { AdminDashboard }
