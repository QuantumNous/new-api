/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
import { useEffect, useState } from 'react'
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
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { StaggerContainer, StaggerItem } from '@/components/page-transition'
import { formatNumber } from '@/lib/format'
import { getSkillAnalyticsOverview } from './api'
import { MetricCard } from './components/metric-card'
import { DateRangeControl } from './components/date-range-control'
import {
  type DateRangePreset,
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

  const { data, isLoading, isError } = useQuery({
    queryKey: ['skill-analytics', 'overview', preset, refreshTick],
    queryFn: () => getSkillAnalyticsOverview(getDateRange(preset)),
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
      </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
