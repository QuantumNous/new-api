/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
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
  CreditCard,
  Clock,
  Bookmark,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/lib/format'
import { SectionPageLayout } from '@/components/layout'
import { StaggerContainer, StaggerItem } from '@/components/page-transition'
import {
  getMostSavedSkillAnalytics,
  getSkillAnalyticsOverview,
  getSkillAnalyticsSkills,
} from './api'
import { DateRangeControl } from './components/date-range-control'
import { MetricCard } from './components/metric-card'
import {
  type DateRangePreset,
  type SkillAnalyticsSkillsResponse,
  type SkillAnalyticsSkillRow,
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

function formatDuration(value: number | null): string | null {
  if (value === null) return null
  if (value < 3600) return `${Math.round(value / 60)}m`
  if (value < 86400) return `${(value / 3600).toFixed(1)}h`
  return `${(value / 86400).toFixed(1)}d`
}

function planLabel(plan: string): string {
  if (plan === '') return 'free'
  return plan.replaceAll('_', ' ')
}

export function SkillAnalyticsDashboard() {
  const { t } = useTranslation()
  const [preset, setPreset] = useState<DateRangePreset>('7d')
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setRefreshTick((tick) => tick + 1)
    }, 60 * 1000)
    return () => window.clearInterval(id)
  }, [])

  const range = useMemo(() => getDateRange(preset), [preset, refreshTick])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['skill-analytics', 'overview', preset, refreshTick],
    queryFn: () => getSkillAnalyticsOverview(range),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const { data: skillsData, isLoading: skillsLoading } = useQuery({
    queryKey: ['skill-analytics', 'skills', preset, refreshTick],
    queryFn: () => getSkillAnalyticsSkills(range),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
  const mostSavedQuery = useQuery({
    queryKey: ['skill-analytics', 'most-saved', preset, refreshTick],
    queryFn: () => getMostSavedSkillAnalytics(range),
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
      description: t(
        'Share of eligible users who have enabled at least one skill'
      ),
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
      description: t(
        'Users who made a skill call more than once in the period'
      ),
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
        ? data.top_block_reason !== null
          ? t(getBlockReasonLabelKey(data.top_block_reason))
          : null
        : null,
      description: t('Most common reason for skill call rejection'),
      icon: AlertTriangle,
    },
    ...(data?.charging_enabled !== false
      ? [
          {
            title: t('Recharge to First Skill Use'),
            value: data ? formatPercent(data.recharge_to_first_use_rate) : null,
            description: t(
              'Attribution: successful top-ups followed by first Skill use'
            ),
            icon: CreditCard,
          },
          {
            title: t('Skill Use to Repeat Recharge'),
            value: data
              ? formatPercent(data.skill_use_to_repeat_recharge_rate)
              : null,
            description: t('Attribution: Skill users who recharged again'),
            icon: Repeat2,
          },
          {
            title: t('Median Time to First Use'),
            value: data
              ? formatDuration(data.median_time_to_first_use_seconds)
              : null,
            description: t(
              'Attribution: median delay from recharge to first Skill use'
            ),
            icon: Clock,
          },
          {
            title: t('Revenue Attribution'),
            value: data ? formatUsd(data.revenue_attribution_usd) : null,
            description: t(
              'Attribution: repeat recharge revenue after Skill use'
            ),
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
          <div className='flex flex-wrap items-center justify-between gap-3'>
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
              className='border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm'
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

          {data?.charging_enabled !== false && (
            <MonetizationSkillTable
              rows={skillsData?.skills ?? []}
              loading={skillsLoading}
            />
          )}
          <MostSavedSkillPanel query={mostSavedQuery} />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

interface MostSavedSkillPanelProps {
  query: UseQueryResult<SkillAnalyticsSkillsResponse, Error>
}

function MostSavedSkillPanel({ query }: MostSavedSkillPanelProps) {
  const { t } = useTranslation()

  return (
    <section className='bg-background/60 rounded-xl border p-4'>
      <div className='mb-3 flex items-center gap-2'>
        <Bookmark className='text-muted-foreground size-4' aria-hidden='true' />
        <h2 className='text-base font-semibold'>{t('Most-Saved Skills')}</h2>
      </div>
      {query.isLoading ? (
        <div className='text-muted-foreground text-sm'>{t('Loading…')}</div>
      ) : query.isError ? (
        <div className='text-muted-foreground text-sm'>
          {t('Most-saved data is unavailable.')}
        </div>
      ) : (query.data?.skills.length ?? 0) === 0 ? (
        <div className='text-muted-foreground text-sm'>
          {t('No saved Skill data in this period.')}
        </div>
      ) : (
        <div className='divide-y'>
          {query.data?.skills.map((skill) => (
            <div
              key={skill.skill_id}
              className='grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2 text-sm'
            >
              <span className='min-w-0 truncate font-medium'>
                {skill.skill_name}
              </span>
              <span className='text-muted-foreground tabular-nums'>
                {skill.saved_users} {t('saved')}
              </span>
              <span className='text-muted-foreground tabular-nums'>
                {skill.saved_but_unused_users} {t('saved but unused')}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

interface MonetizationSkillTableProps {
  rows: SkillAnalyticsSkillRow[]
  loading: boolean
}

function MonetizationSkillTable(props: MonetizationSkillTableProps) {
  const { t } = useTranslation()

  return (
    <section className='bg-background/60 rounded-xl border p-3'>
      <div className='mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <h2 className='text-sm font-semibold'>
            {t('Monetization by Skill')}
          </h2>
          <p className='text-muted-foreground text-xs'>
            {t('Attribution metrics, grouped by Skill and plan')}
          </p>
        </div>
      </div>
      <div className='overflow-x-auto'>
        <table className='w-full min-w-[760px] text-left text-sm'>
          <thead className='text-muted-foreground border-b text-xs'>
            <tr>
              <th className='py-2 pr-3 font-medium'>{t('Skill')}</th>
              <th className='py-2 pr-3 font-medium'>{t('Plan')}</th>
              <th className='py-2 pr-3 font-medium'>
                {t('Recharge → first use')}
              </th>
              <th className='py-2 pr-3 font-medium'>{t('Median time')}</th>
              <th className='py-2 pr-3 font-medium'>
                {t('Use → repeat recharge')}
              </th>
              <th className='py-2 font-medium'>{t('Revenue attribution')}</th>
            </tr>
          </thead>
          <tbody className='divide-y'>
            {props.loading ? (
              <tr>
                <td
                  colSpan={6}
                  className='text-muted-foreground py-6 text-center text-xs'
                >
                  {t('Loading')}
                </td>
              </tr>
            ) : props.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className='text-muted-foreground py-6 text-center text-xs'
                >
                  {t('No data in this period')}
                </td>
              </tr>
            ) : (
              props.rows.map((row) => (
                <tr key={row.skill_id} className='align-top'>
                  <td className='py-2 pr-3 font-medium'>{row.skill_name}</td>
                  <td className='text-muted-foreground py-2 pr-3 text-xs capitalize'>
                    {planLabel(row.required_plan)}
                  </td>
                  <td className='py-2 pr-3 tabular-nums'>
                    {formatPercent(row.recharge_to_first_use_rate) ?? '—'}
                  </td>
                  <td className='py-2 pr-3 tabular-nums'>
                    {formatDuration(row.median_time_to_first_use_seconds) ??
                      '—'}
                  </td>
                  <td className='py-2 pr-3 tabular-nums'>
                    {formatPercent(row.skill_use_to_repeat_recharge_rate) ??
                      '—'}
                  </td>
                  <td className='py-2 tabular-nums'>
                    {formatUsd(row.revenue_attribution_usd) ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
