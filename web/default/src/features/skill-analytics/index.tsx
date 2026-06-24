/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Users,
  Play,
  MousePointerClick,
  ToggleRight,
  UserCheck,
  Repeat2,
  ShieldX,
  AlertTriangle,
  DollarSign,
  TriangleAlert,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Search,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { StaggerContainer, StaggerItem } from '@/components/page-transition'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { getSkillAnalyticsOverview, getSkillAnalyticsSkills } from './api'
import { MetricCard } from './components/metric-card'
import { DateRangeControl } from './components/date-range-control'
import {
  type DateRangePreset,
  type SkillAnalyticsPersona,
  type SkillAnalyticsPlan,
  type SkillAnalyticsSkillRow,
  type SkillAnalyticsSort,
  type SkillAnalyticsSortKey,
  type SkillAnalyticsStatus,
  getDateRange,
  getBlockReasonLabelKey,
} from './types'

function fmtCount(value: number | null): string | null {
  if (value === null) return null
  return formatNumber(value)
}

function formatPercent(value: number | null): string | null {
  if (value === null) return null
  return `${(value * 100).toFixed(1)}%`
}

function formatUsd(value: number | null): string | null {
  if (value === null) return null
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const PAGE_SIZE = 20

const SORTABLE_COLUMNS: Array<{
  key: SkillAnalyticsSortKey
  label: string
  align?: 'left' | 'right'
}> = [
  { key: 'skill_name', label: 'Skill name', align: 'left' },
  { key: 'enabled_users', label: 'Enabled users' },
  { key: 'active_users', label: 'Active users' },
  { key: 'successful_runs', label: 'Successful runs' },
  { key: 'detail_ctr', label: 'Detail CTR' },
  { key: 'enable_rate', label: 'Enable rate' },
  { key: 'first_use_rate', label: 'First use rate' },
  { key: 'repeat_use_rate', label: 'Repeat use rate' },
  { key: 'one_time_rate', label: 'One-time rate' },
  { key: 'block_rate', label: 'Block rate' },
]

function labelFromValue(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function SkillAnalyticsDashboard() {
  const { t } = useTranslation()
  const [preset, setPreset] = useState<DateRangePreset>('7d')
  const [refreshTick, setRefreshTick] = useState(0)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SkillAnalyticsSort>('-successful_runs')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | SkillAnalyticsStatus>('all')
  const [requiredPlan, setRequiredPlan] = useState<'all' | SkillAnalyticsPlan>('all')
  const [plan, setPlan] = useState<'all' | SkillAnalyticsPlan>('all')
  const [persona, setPersona] = useState<'all' | SkillAnalyticsPersona>('all')

  useEffect(() => {
    const id = window.setInterval(() => {
      setRefreshTick((tick) => tick + 1)
    }, 60 * 1000)
    return () => window.clearInterval(id)
  }, [])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['skill-analytics', 'overview', preset, refreshTick],
    queryFn: () => getSkillAnalyticsOverview(getDateRange(preset)),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const range = useMemo(() => getDateRange(preset), [preset, refreshTick])

  const skillParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      sort,
      ...(query.trim() ? { q: query.trim() } : {}),
      ...(status !== 'all' ? { status } : {}),
      ...(requiredPlan !== 'all' ? { required_plan: requiredPlan } : {}),
      ...(plan !== 'all' ? { plan } : {}),
      ...(persona !== 'all' ? { persona } : {}),
    }),
    [page, sort, query, status, requiredPlan, plan, persona]
  )

  const {
    data: skillsData,
    isLoading: skillsLoading,
    isFetching: skillsFetching,
    isError: skillsError,
  } = useQuery({
    queryKey: ['skill-analytics', 'skills', preset, refreshTick, skillParams],
    queryFn: () => getSkillAnalyticsSkills(range, skillParams),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const trackingFailed = data?.data_freshness === 'failed'
  const trackingDelayed = data?.data_freshness === 'delayed'

  const cards = [
    {
      title: t('Weekly Active Skill Users'),
      value: data ? fmtCount(data.wasu) : null,
      description: t('Users who ran at least one skill call during the period'),
      icon: Users,
    },
    {
      title: t('Total Skill Runs'),
      value: data ? fmtCount(data.total_skill_runs) : null,
      description: t('Total skill relay requests in the period'),
      icon: Play,
    },
    {
      title: t('Skill Detail CTR'),
      value: data ? formatPercent(data.detail_ctr) : null,
      description: t('Users who viewed a skill detail page then ran the skill'),
      icon: MousePointerClick,
    },
    {
      title: t('Enable Rate'),
      value: data ? formatPercent(data.enable_rate) : null,
      description: t('Share of eligible users who have enabled at least one skill'),
      icon: ToggleRight,
    },
    {
      title: t('First Use Rate'),
      value: data ? formatPercent(data.first_use_rate) : null,
      description: t('First-time skill users as a share of total active users'),
      icon: UserCheck,
    },
    {
      title: t('Repeat Use Rate'),
      value: data ? formatPercent(data.repeat_use_rate) : null,
      description: t('Users who made a skill call more than once in the period'),
      icon: Repeat2,
    },
    {
      title: t('Block Rate'),
      value: data ? formatPercent(data.block_rate) : null,
      description: t('Skill calls blocked by policy or quota enforcement'),
      icon: ShieldX,
    },
    {
      title: t('Top Block Reason'),
      value: data
        ? (data.top_block_reason !== null ? t(getBlockReasonLabelKey(data.top_block_reason)) : null)
        : null,
      description: t('Most common reason for skill call rejection'),
      icon: AlertTriangle,
    },
    ...(data?.charging_enabled !== false
      ? [
          {
            title: t('Revenue Attribution'),
            value: data ? formatUsd(data.revenue_attribution_usd) : null,
            description: t('Revenue from skill usage during the period'),
            icon: DollarSign,
          },
        ]
      : []),
  ]

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Skill Analytics')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Skill analytics overview for the operator')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
      <div className='flex flex-col gap-6'>
        {/* Date range control */}
        <div className='flex items-center justify-between gap-3 flex-wrap'>
          <DateRangeControl value={preset} onChange={setPreset} />
        </div>

        {/* Tracking failure banner */}
        {(trackingFailed || trackingDelayed) && (
          <div
            role='alert'
            className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
              trackingFailed
                ? 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400'
                : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
            }`}
          >
            <TriangleAlert className='size-4 shrink-0' aria-hidden='true' />
            <span>
              {trackingFailed
                ? t(
                    'Data tracking is unavailable. Metrics shown below are stale or missing.'
                  )
                : t(
                    'Data tracking is delayed. Metrics may not reflect the latest activity.'
                  )}
            </span>
          </div>
        )}

        {/* API error (e.g. DR-75 not yet deployed) */}
        {isError && (
          <div
            role='alert'
            className='rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive'
          >
            {t(
              'Skill analytics data is unavailable. The analytics API (DR-75) may not be deployed yet.'
            )}
          </div>
        )}

        {/* Metric cards grid */}
        <StaggerContainer className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
          {cards.map((card) => (
            <StaggerItem key={card.title}>
              <MetricCard
                title={card.title}
                value={card.value}
                description={card.description}
                icon={card.icon}
                loading={isLoading}
                trackingFailed={trackingFailed}
              />
            </StaggerItem>
          ))}
        </StaggerContainer>

        <SkillAnalyticsTable
          rows={skillsData?.skills ?? []}
          page={skillsData?.pagination.page ?? page}
          limit={skillsData?.pagination.limit ?? PAGE_SIZE}
          total={skillsData?.pagination.total ?? 0}
          hasNext={skillsData?.pagination.has_next ?? false}
          sort={sort}
          query={query}
          status={status}
          requiredPlan={requiredPlan}
          plan={plan}
          persona={persona}
          chargingEnabled={skillsData?.charging_enabled ?? data?.charging_enabled ?? false}
          loading={skillsLoading}
          fetching={skillsFetching}
          error={skillsError}
          onPageChange={setPage}
          onSortChange={(next) => {
            setSort(next)
            setPage(1)
          }}
          onQueryChange={(next) => {
            setQuery(next)
            setPage(1)
          }}
          onStatusChange={(next) => {
            setStatus(next)
            setPage(1)
          }}
          onRequiredPlanChange={(next) => {
            setRequiredPlan(next)
            setPage(1)
          }}
          onPlanChange={(next) => {
            setPlan(next)
            setPage(1)
          }}
          onPersonaChange={(next) => {
            setPersona(next)
            setPage(1)
          }}
        />
      </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

interface SkillAnalyticsTableProps {
  rows: SkillAnalyticsSkillRow[]
  page: number
  limit: number
  total: number
  hasNext: boolean
  sort: SkillAnalyticsSort
  query: string
  status: 'all' | SkillAnalyticsStatus
  requiredPlan: 'all' | SkillAnalyticsPlan
  plan: 'all' | SkillAnalyticsPlan
  persona: 'all' | SkillAnalyticsPersona
  chargingEnabled: boolean
  loading: boolean
  fetching: boolean
  error: boolean
  onPageChange: (page: number) => void
  onSortChange: (sort: SkillAnalyticsSort) => void
  onQueryChange: (query: string) => void
  onStatusChange: (status: 'all' | SkillAnalyticsStatus) => void
  onRequiredPlanChange: (plan: 'all' | SkillAnalyticsPlan) => void
  onPlanChange: (plan: 'all' | SkillAnalyticsPlan) => void
  onPersonaChange: (persona: 'all' | SkillAnalyticsPersona) => void
}

function SkillAnalyticsTable(props: SkillAnalyticsTableProps) {
  const { t } = useTranslation()
  const from = props.total === 0 ? 0 : (props.page - 1) * props.limit + 1
  const to = Math.min(props.page * props.limit, props.total)

  return (
    <section className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div className='flex flex-col gap-1'>
          <h2 className='text-lg font-semibold'>{t('Per-Skill Analytics')}</h2>
          <p className='text-muted-foreground text-sm'>
            {t('Aggregate table for usage, activation, stickiness, one-time use, and blocks.')}
          </p>
        </div>
      </div>

      <div className='bg-card flex flex-wrap items-center gap-2 rounded-xl border p-3'>
        <div className='relative min-w-52 flex-1'>
          <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
          <Input
            value={props.query}
            onChange={(event) => props.onQueryChange(event.target.value)}
            placeholder={t('Search skills')}
            className='pl-8'
          />
        </div>
        <FilterSelect
          label={t('Status')}
          value={props.status}
          options={['all', 'draft', 'published', 'deprecated', 'archived']}
          onChange={props.onStatusChange}
        />
        <FilterSelect
          label={t('Required plan')}
          value={props.requiredPlan}
          options={['all', 'free', 'pro', 'enterprise']}
          onChange={props.onRequiredPlanChange}
        />
        <FilterSelect
          label={t('Audience plan')}
          value={props.plan}
          options={['all', 'free', 'pro', 'enterprise']}
          onChange={props.onPlanChange}
        />
        <FilterSelect
          label={t('Persona')}
          value={props.persona}
          options={['all', 'casual', 'dev', 'team', 'unset']}
          onChange={props.onPersonaChange}
        />
      </div>

      {props.error && (
        <div role='alert' className='rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
          {t('Per-skill analytics data is unavailable.')}
        </div>
      )}

      <div className='rounded-xl border bg-card'>
        <Table className={cn('min-w-[1320px]', props.fetching && 'opacity-60')}>
          <TableHeader className='sticky top-0 z-10 bg-card'>
            <TableRow>
              {SORTABLE_COLUMNS.slice(0, 1).map((column) => (
                <SortableHead
                  key={column.key}
                  column={column.key}
                  label={t(column.label)}
                  sort={props.sort}
                  align='left'
                  onSortChange={props.onSortChange}
                />
              ))}
              <TableHead>{t('Status')}</TableHead>
              <TableHead>{t('Required plan')}</TableHead>
              {SORTABLE_COLUMNS.slice(1).map((column) => (
                <SortableHead
                  key={column.key}
                  column={column.key}
                  label={t(column.label)}
                  sort={props.sort}
                  align='right'
                  onSortChange={props.onSortChange}
                />
              ))}
              {props.chargingEnabled && (
                <TableHead className='text-right'>{t('Revenue Attribution')}</TableHead>
              )}
              <TableHead>{t('Trend')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={props.chargingEnabled ? 14 : 13} className='text-muted-foreground h-12'>
                    {t('Loading analytics rows')}
                  </TableCell>
                </TableRow>
              ))
            ) : props.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={props.chargingEnabled ? 14 : 13} className='text-muted-foreground h-24 text-center'>
                  {t('No per-skill analytics match the selected filters.')}
                </TableCell>
              </TableRow>
            ) : (
              props.rows.map((row) => (
                <TableRow key={row.skill_id}>
                  <TableCell className='font-medium'>{row.skill_name}</TableCell>
                  <TableCell>
                    <StatusBadge label={t(labelFromValue(row.status))} variant={statusVariant(row.status)} copyable={false} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge label={t(labelFromValue(row.required_plan))} variant={planVariant(row.required_plan)} copyable={false} />
                  </TableCell>
                  <NumberCell value={row.enabled_users} />
                  <NumberCell value={row.active_users} />
                  <NumberCell value={row.successful_runs} />
                  <PercentCell value={row.detail_ctr} />
                  <PercentCell value={row.enable_rate} />
                  <PercentCell value={row.first_use_rate} />
                  <PercentCell value={row.repeat_use_rate} strong />
                  <PercentCell value={row.one_time_rate} />
                  <PercentCell value={row.block_rate} />
                  {props.chargingEnabled && <MoneyCell value={row.revenue_attribution_usd} />}
                  <TableCell>
                    <TrendBadge trend={row.trend} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className='flex flex-wrap items-center justify-between gap-2 text-sm'>
        <span className='text-muted-foreground tabular-nums'>
          {t('Showing {{from}}-{{to}} of {{total}} skills', { from, to, total: props.total })}
        </span>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            disabled={props.page <= 1 || props.loading}
            onClick={() => props.onPageChange(Math.max(1, props.page - 1))}
          >
            {t('Previous')}
          </Button>
          <Button
            variant='outline'
            size='sm'
            disabled={!props.hasNext || props.loading}
            onClick={() => props.onPageChange(props.page + 1)}
          >
            {t('Next')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function SortableHead({
  column,
  label,
  sort,
  align = 'right',
  onSortChange,
}: {
  column: SkillAnalyticsSortKey
  label: string
  sort: SkillAnalyticsSort
  align?: 'left' | 'right'
  onSortChange: (sort: SkillAnalyticsSort) => void
}) {
  const active = sort === column || sort === `-${column}`
  const descending = sort === `-${column}`
  const Icon = !active ? ArrowUpDown : descending ? ArrowDown : ArrowUp
  const nextSort = active && descending ? column : (`-${column}` as SkillAnalyticsSort)
  return (
    <TableHead className={align === 'right' ? 'text-right' : undefined}>
      <Button
        variant='ghost'
        size='sm'
        className={cn('h-8 px-2', align === 'right' && 'ml-auto')}
        onClick={() => onSortChange(nextSort)}
      >
        {label}
        <Icon data-icon='inline-end' aria-hidden='true' />
      </Button>
    </TableHead>
  )
}

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: T[]
  onChange: (value: T) => void
}) {
  const { t } = useTranslation()
  return (
    <label className='flex items-center gap-2 text-xs text-muted-foreground'>
      <span>{label}</span>
      <NativeSelect
        size='sm'
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option === 'all' ? t('All') : t(labelFromValue(option))}
          </option>
        ))}
      </NativeSelect>
    </label>
  )
}

function NumberCell({ value }: { value: number }) {
  return <TableCell className='text-right font-mono tabular-nums'>{formatNumber(value)}</TableCell>
}

function PercentCell({ value, strong }: { value: number | null; strong?: boolean }) {
  return (
    <TableCell className={cn('text-right font-mono tabular-nums', strong && 'font-semibold')}>
      {formatPercent(value) ?? '—'}
    </TableCell>
  )
}

function MoneyCell({ value }: { value: number | null }) {
  return <TableCell className='text-right font-mono tabular-nums'>{formatUsd(value) ?? '—'}</TableCell>
}

function TrendBadge({ trend }: { trend: SkillAnalyticsSkillRow['trend'] }) {
  const { t } = useTranslation()
  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const variant = trend === 'up' ? 'success' : trend === 'down' ? 'warning' : 'neutral'
  return (
    <StatusBadge
      icon={Icon}
      label={t(labelFromValue(trend))}
      variant={variant}
      copyable={false}
      showDot={false}
    />
  )
}

function statusVariant(status: SkillAnalyticsStatus) {
  if (status === 'published') return 'success'
  if (status === 'deprecated') return 'warning'
  if (status === 'archived') return 'danger'
  return 'neutral'
}

function planVariant(plan: SkillAnalyticsPlan) {
  if (plan === 'free') return 'green'
  if (plan === 'pro') return 'blue'
  return 'purple'
}
