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
import { Fragment, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { VChart } from '@visactor/react-vchart'
import {
  Activity,
  ChevronRight,
  CircleAlert,
  EyeOff,
  GitBranch,
  Hash,
  Info,
  Loader2,
  Route,
  WalletCards,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { formatNumber, formatQuota } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { computeTimeRange } from '@/lib/time'
import { useChartTheme } from '@/lib/use-chart-theme'
import { cn } from '@/lib/utils'
import { VCHART_OPTION } from '@/lib/vchart'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toggle } from '@/components/ui/toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { MultiSelect } from '@/components/multi-select'
import { getFlowQuotaDates } from '@/features/dashboard/api'
import {
  buildDashboardFlowData,
  buildFlowSankeySpec,
  buildQueryParams,
  getDefaultDays,
  getFlowStages,
} from '@/features/dashboard/lib'
import {
  compactFlowSelectionLabel,
  flowDisplayState,
  requireSuccessfulFlowRows,
} from '@/features/dashboard/lib/flow-selection'
import type {
  DashboardFilters,
  FlowMetric,
  FlowNodeKind,
  FlowRole,
  FlowSummary,
} from '@/features/dashboard/types'

interface FlowChartsProps {
  filters?: DashboardFilters
}

interface FlowStatsProps {
  summary: FlowSummary
  loading?: boolean
}

const FLOW_METRIC_OPTIONS = [
  { value: 'quota', labelKey: 'Quota', icon: WalletCards },
  { value: 'tokens', labelKey: 'Tokens', icon: Hash },
  { value: 'requests', labelKey: 'Requests', icon: Activity },
] as const

// A Sankey needs at least two columns to render any link.
const MIN_VISIBLE_STAGES = 2

const FLOW_STAGE_META: Record<
  FlowNodeKind,
  { labelKey: string; descKey: string }
> = {
  user: {
    labelKey: 'User',
    descKey: 'The user who made the requests',
  },
  node: {
    labelKey: 'Node',
    descKey: 'The deployment node that handled the requests',
  },
  token: {
    labelKey: 'Token',
    descKey: 'The API key used for the requests',
  },
  group: {
    labelKey: 'Group',
    descKey: 'The user group applied to the requests',
  },
  model: {
    labelKey: 'Model',
    descKey: 'The model that was requested',
  },
  channel: {
    labelKey: 'Channel',
    descKey: 'The upstream channel that served the requests',
  },
}

function FlowStats(props: FlowStatsProps) {
  const { t } = useTranslation()
  const items = [
    {
      key: 'quota',
      title: 'Quota',
      value: formatQuota(props.summary.quota),
      icon: WalletCards,
    },
    {
      key: 'tokens',
      title: 'Tokens',
      value: formatNumber(props.summary.tokens),
      icon: Hash,
    },
    {
      key: 'requests',
      title: 'Requests',
      value: formatNumber(props.summary.requests),
      icon: Activity,
    },
  ]

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='divide-border/60 grid grid-cols-3 divide-x'>
        {items.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.key} className='px-3 py-2.5 sm:px-5 sm:py-4'>
              <div className='flex items-center gap-2'>
                <Icon className='text-muted-foreground/60 size-3.5 shrink-0' />
                <div className='text-muted-foreground truncate text-xs font-medium tracking-wider uppercase'>
                  {t(item.title)}
                </div>
              </div>
              {props.loading ? (
                <div className='mt-2 flex flex-col gap-1.5'>
                  <Skeleton className='h-7 w-20' />
                  <Skeleton className='h-3.5 w-28' />
                </div>
              ) : (
                <div className='text-foreground mt-1.5 font-mono text-lg font-bold tracking-tight tabular-nums sm:mt-2 sm:text-2xl'>
                  {item.value}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FlowCharts(props: FlowChartsProps) {
  const { t } = useTranslation()
  const { resolvedTheme, themeReady } = useChartTheme()
  const user = useAuthStore((state) => state.auth.user)
  const isRoot = Boolean(user?.role && user.role >= ROLE.SUPER_ADMIN)
  const isAdmin = Boolean(user?.role && user.role >= ROLE.ADMIN)
  const flowRole: FlowRole = isRoot ? 'root' : isAdmin ? 'admin' : 'user'
  const [metric, setMetric] = useState<FlowMetric>('quota')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [hiddenStages, setHiddenStages] = useState<FlowNodeKind[]>([])

  const stages = useMemo(() => getFlowStages(flowRole), [flowRole])
  const visibleStages = useMemo(
    () => stages.filter((stage) => !hiddenStages.includes(stage)),
    [stages, hiddenStages]
  )
  const toggleStage = (stage: FlowNodeKind) => {
    setHiddenStages((prev) => {
      const hidden = new Set(prev)
      if (hidden.has(stage)) {
        hidden.delete(stage)
      } else {
        const remaining = stages.filter((item) => !hidden.has(item)).length
        if (remaining <= MIN_VISIBLE_STAGES) return prev
        hidden.add(stage)
      }
      return stages.filter((item) => hidden.has(item))
    })
  }

  const timeRange = useMemo(
    () =>
      computeTimeRange(
        getDefaultDays(props.filters?.time_granularity),
        props.filters?.start_timestamp,
        props.filters?.end_timestamp
      ),
    [
      props.filters?.end_timestamp,
      props.filters?.start_timestamp,
      props.filters?.time_granularity,
    ]
  )
  const flowQueryParams = useMemo(
    () => buildQueryParams(timeRange, props.filters),
    [props.filters, timeRange]
  )

  const {
    data: flowRows,
    error: flowError,
    isError,
    isLoading,
  } = useQuery({
    queryKey: ['dashboard', 'flow', flowQueryParams, flowRole],
    queryFn: () => getFlowQuotaDates(flowQueryParams, isAdmin),
    select: (res) =>
      requireSuccessfulFlowRows(res, t('Please try again later.')),
    staleTime: 60_000,
  })

  const flowData = useMemo(
    () =>
      buildDashboardFlowData(isLoading ? [] : (flowRows ?? []), metric, {
        role: flowRole,
        selectedUsers,
        visibleStages,
        deletedTokenLabel: (tokenId) => t('Deleted ({{id}})', { id: tokenId }),
      }),
    [flowRole, flowRows, isLoading, metric, selectedUsers, visibleStages, t]
  )
  const userFilterOptions = useMemo(
    () =>
      flowData.filterOptions.users.map((user) => ({
        label: `${user.label} · ${user.valueLabel}`,
        value: user.value,
      })),
    [flowData.filterOptions.users]
  )
  const chartTitle = t('Flow')
  const flowSpec = useMemo(
    () =>
      buildFlowSankeySpec(flowData.flow, chartTitle, formatQuota, {
        quota: t('Quota'),
        tokens: t('Tokens'),
        requests: t('Requests'),
        share: t('Share'),
      }),
    [chartTitle, flowData.flow, t]
  )
  const chartTheme = resolvedTheme === 'dark' ? 'dark' : 'light'
  const chartKey = [
    metric,
    flowRole,
    selectedUsers.join(','),
    visibleStages.join(','),
    flowRows?.length ?? 0,
    resolvedTheme,
  ].join('-')
  const displayState = flowDisplayState({
    isLoading,
    isError,
    linkCount: flowData.flow.links.length,
    themeReady,
  })
  const flowErrorMessage =
    flowError instanceof Error
      ? flowError.message
      : t('Please try again later.')

  return (
    <div className='flex flex-col gap-3'>
      <FlowStats summary={flowData.summary} loading={isLoading} />

      <div className='flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between'>
        <div className='flex flex-wrap items-center gap-2'>
          <Tabs
            value={metric}
            onValueChange={(value) => setMetric(value as FlowMetric)}
            className='shrink-0'
          >
            <TabsList>
              {FLOW_METRIC_OPTIONS.map((option) => (
                <TabsTrigger
                  key={option.value}
                  value={option.value}
                  className='px-2.5 text-xs'
                >
                  {t(option.labelKey)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        {isAdmin && (
          <div className='flex min-w-0 flex-col gap-2 sm:flex-row lg:w-[min(24rem,34vw)]'>
            <MultiSelect
              options={userFilterOptions}
              selected={selectedUsers}
              onChange={setSelectedUsers}
              placeholder={t('All users')}
              emptyText={t('No users')}
              maxVisibleChips={2}
              renderSelectedSummary={(values) =>
                compactFlowSelectionLabel(values.length)
              }
            />
          </div>
        )}
        {isLoading && (
          <Loader2 className='text-muted-foreground size-4 animate-spin' />
        )}
      </div>

      <div className='overflow-hidden rounded-lg border'>
        <div className='flex w-full flex-col gap-2 border-b px-3 py-2 sm:px-5 sm:py-3 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex min-w-0 items-center gap-2'>
            <GitBranch className='text-muted-foreground/60 size-4 shrink-0' />
            <div className='text-sm font-semibold'>{chartTitle}</div>
          </div>
          <TooltipProvider>
            <div className='flex min-w-0 items-center gap-1 overflow-x-auto pb-1 lg:justify-end lg:pb-0'>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type='button'
                      className='text-muted-foreground/60 hover:text-foreground flex size-6 shrink-0 items-center justify-center rounded-md'
                      aria-label={t('Show or hide flow columns')}
                    />
                  }
                >
                  <Info className='size-3.5' />
                </TooltipTrigger>
                <TooltipContent className='max-w-[16rem]'>
                  {t('Click a stage to show or hide that column')}
                </TooltipContent>
              </Tooltip>
              {stages.map((stage, index) => {
                const meta = FLOW_STAGE_META[stage]
                const visible = !hiddenStages.includes(stage)
                return (
                  <Fragment key={stage}>
                    {index > 0 && (
                      <ChevronRight className='text-muted-foreground/40 size-3.5 shrink-0' />
                    )}
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Toggle
                            variant='outline'
                            size='sm'
                            pressed={visible}
                            onPressedChange={() => toggleStage(stage)}
                            aria-label={t(meta.labelKey)}
                            className={cn('shrink-0', !visible && 'opacity-50')}
                          />
                        }
                      >
                        {!visible && <EyeOff className='size-3' />}
                        {t(meta.labelKey)}
                      </TooltipTrigger>
                      <TooltipContent>{t(meta.descKey)}</TooltipContent>
                    </Tooltip>
                  </Fragment>
                )
              })}
            </div>
          </TooltipProvider>
        </div>
        <div className='h-[560px] p-1.5 sm:h-[680px] sm:p-2 2xl:h-[760px]'>
          {displayState === 'loading' ? (
            <Skeleton className='h-full w-full' />
          ) : displayState === 'error' ? (
            <div className='flex h-full items-center justify-center p-4'>
              <Alert variant='destructive' className='max-w-md'>
                <CircleAlert />
                <AlertTitle>{t('Failed to load')}</AlertTitle>
                <AlertDescription>{flowErrorMessage}</AlertDescription>
              </Alert>
            </div>
          ) : displayState === 'empty' ? (
            <Empty className='h-full border-0 py-12'>
              <EmptyHeader>
                <EmptyMedia variant='icon'>
                  <Route />
                </EmptyMedia>
                <EmptyTitle>{t('No flow data available')}</EmptyTitle>
                <EmptyDescription>{t('No data available')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <VChart
              key={`flow-${chartKey}`}
              spec={{
                ...flowSpec,
                theme: chartTheme,
                background: 'transparent',
              }}
              option={VCHART_OPTION}
            />
          )}
        </div>
      </div>
    </div>
  )
}
