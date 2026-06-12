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
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { VChart } from '@visactor/react-vchart'
import {
  Activity,
  CircleAlert,
  ChevronDown,
  GitBranch,
  Hash,
  KeyRound,
  Loader2,
  Route,
  WalletCards,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { formatNumber, formatQuota } from '@/lib/format'
import { computeTimeRange } from '@/lib/time'
import { useChartTheme } from '@/lib/use-chart-theme'
import { cn } from '@/lib/utils'
import { VCHART_OPTION } from '@/lib/vchart'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MultiSelect } from '@/components/multi-select'
import { getFlowQuotaDates } from '@/features/dashboard/api'
import {
  buildDashboardFlowData,
  buildFlowSankeySpec,
  buildQueryParams,
  getDefaultDays,
} from '@/features/dashboard/lib'
import {
  compactFlowSelectionLabel,
  flowDisplayState,
  requireSuccessfulFlowRows,
  selectedTokenValuesForUser,
  updateSelectedTokensForUser,
  visibleFlowUsers,
  type SelectedTokensByUser,
} from '@/features/dashboard/lib/flow-selection'
import type {
  DashboardFilters,
  FlowMetric,
  FlowPathMode,
  FlowUserFilterOption,
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

const FLOW_ENDPOINT_OPTIONS = [
  { value: 'model', labelKey: 'Model' },
  { value: 'channel', labelKey: 'Channel' },
] as const

type FlowEndpointMode = (typeof FLOW_ENDPOINT_OPTIONS)[number]['value']

function selectedPathMode(
  endpointMode: FlowEndpointMode,
  includeBothDimensions: boolean
): FlowPathMode {
  return includeBothDimensions ? 'model-channel' : endpointMode
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
                <>
                  <div className='text-foreground mt-1.5 font-mono text-lg font-bold tracking-tight tabular-nums sm:mt-2 sm:text-2xl'>
                    {item.value}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface FlowUserTokenFiltersProps {
  users: FlowUserFilterOption[]
  selectedTokensByUser: SelectedTokensByUser
  onUserTokensChange: (userID: string, tokenIDs: string[]) => void
}

function FlowUserTokenFilters(props: FlowUserTokenFiltersProps) {
  const { t } = useTranslation()

  if (props.users.length === 0) return null

  return (
    <div className='flex min-w-0 flex-wrap items-center gap-1.5'>
      {props.users.map((user) => {
        const selectedTokens = selectedTokenValuesForUser(
          props.selectedTokensByUser,
          user.value
        )
        const tokenOptions = user.tokens.map((token) => ({
          label: `${token.label} · ${token.valueLabel}`,
          value: token.value,
        }))
        const tokenStateLabel = compactFlowSelectionLabel(selectedTokens.length)

        return (
          <Popover key={user.value}>
            <PopoverTrigger
              render={
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='max-w-56 justify-start gap-1.5 px-2'
                  aria-label={`${t('User')} ${user.label}`}
                />
              }
            >
              <span
                className='size-2.5 shrink-0 rounded-full'
                style={{ backgroundColor: user.color }}
                aria-hidden='true'
              />
              <span className='truncate'>{user.label}</span>
              <span className='text-muted-foreground shrink-0 font-mono text-[11px]'>
                {tokenStateLabel}
              </span>
              <ChevronDown className='text-muted-foreground ml-0.5 shrink-0' />
            </PopoverTrigger>
            <PopoverContent
              className='w-[min(22rem,calc(100vw-2rem))]'
              align='end'
              sideOffset={6}
            >
              <PopoverHeader>
                <PopoverTitle className='flex min-w-0 items-center gap-2'>
                  <span
                    className='size-2.5 shrink-0 rounded-full'
                    style={{ backgroundColor: user.color }}
                    aria-hidden='true'
                  />
                  <span className='truncate'>{user.label}</span>
                  <span className='text-muted-foreground font-mono text-xs'>
                    {user.valueLabel}
                  </span>
                </PopoverTitle>
              </PopoverHeader>
              <div className='flex items-center gap-2'>
                <KeyRound className='text-muted-foreground size-3.5 shrink-0' />
                <MultiSelect
                  options={tokenOptions}
                  selected={selectedTokens}
                  onChange={(values) =>
                    props.onUserTokensChange(user.value, values)
                  }
                  placeholder={t('All API tokens')}
                  emptyText={t('No API tokens')}
                  maxVisibleChips={2}
                  renderSelectedSummary={(values) =>
                    compactFlowSelectionLabel(values.length)
                  }
                />
              </div>
            </PopoverContent>
          </Popover>
        )
      })}
    </div>
  )
}

export function FlowCharts(props: FlowChartsProps) {
  const { t } = useTranslation()
  const { resolvedTheme, themeReady } = useChartTheme()
  const user = useAuthStore((state) => state.auth.user)
  const isAdmin = !!(user?.role && user.role >= 10)
  const [metric, setMetric] = useState<FlowMetric>('quota')
  const [endpointMode, setEndpointMode] = useState<FlowEndpointMode>('channel')
  const [includeBothDimensions, setIncludeBothDimensions] = useState(false)
  const [showTokenLayer, setShowTokenLayer] = useState(true)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedTokensByUser, setSelectedTokensByUser] =
    useState<SelectedTokensByUser>({})

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
    queryKey: ['dashboard', 'flow', flowQueryParams, isAdmin],
    queryFn: () => getFlowQuotaDates(flowQueryParams, isAdmin),
    select: (res) =>
      requireSuccessfulFlowRows(res, t('Please try again later.')),
    staleTime: 60_000,
  })

  const pathMode = selectedPathMode(endpointMode, includeBothDimensions)
  const flowData = useMemo(
    () =>
      buildDashboardFlowData(isLoading ? [] : (flowRows ?? []), metric, {
        pathMode,
        includeTokenLayer: showTokenLayer,
        selectedUsers,
        selectedTokensByUser,
      }),
    [
      flowRows,
      isLoading,
      metric,
      pathMode,
      selectedTokensByUser,
      selectedUsers,
      showTokenLayer,
    ]
  )
  const userFilterOptions = useMemo(
    () =>
      flowData.filterOptions.users.map((user) => ({
        label: `${user.label} · ${user.valueLabel}`,
        value: user.value,
      })),
    [flowData.filterOptions.users]
  )
  const legendUsers = useMemo(
    () => visibleFlowUsers(flowData.filterOptions.users, selectedUsers),
    [flowData.filterOptions.users, selectedUsers]
  )
  const chartTitle = t('Flow')
  const flowSpec = useMemo(
    () =>
      buildFlowSankeySpec(flowData.flow, chartTitle, formatQuota, {
        quota: t('Quota'),
        tokens: t('Tokens'),
        inputTokens: t('Input Tokens'),
        outputTokens: t('Output Tokens'),
        cacheRead: t('Cache Read'),
        cacheWrite: t('Cache Write'),
        requests: t('Requests'),
        share: t('Share'),
      }),
    [chartTitle, flowData.flow, t]
  )
  const chartTheme = resolvedTheme === 'dark' ? 'dark' : 'light'
  const chartKey = [
    metric,
    pathMode,
    showTokenLayer ? 'token' : 'direct',
    selectedUsers.join(','),
    Object.entries(selectedTokensByUser)
      .map(([userID, tokenIDs]) => `${userID}:${tokenIDs.join('|')}`)
      .join(','),
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

  const handleUserTokenSelectionChange = (
    userID: string,
    tokenIDs: string[]
  ) => {
    setSelectedTokensByUser((current) =>
      updateSelectedTokensForUser(current, userID, tokenIDs)
    )
  }

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
          <Button
            type='button'
            variant={showTokenLayer ? 'default' : 'outline'}
            size='sm'
            aria-pressed={showTokenLayer}
            onClick={() => setShowTokenLayer((value) => !value)}
          >
            <KeyRound data-icon='inline-start' />
            {t('API Key')}
          </Button>
          <Tabs
            value={endpointMode}
            onValueChange={(value) =>
              setEndpointMode(value as FlowEndpointMode)
            }
            className={cn(
              'shrink-0',
              includeBothDimensions && 'pointer-events-none opacity-50'
            )}
          >
            <TabsList>
              {FLOW_ENDPOINT_OPTIONS.map((option) => (
                <TabsTrigger
                  key={option.value}
                  value={option.value}
                  disabled={includeBothDimensions}
                  className='px-2.5 text-xs'
                >
                  {t(option.labelKey)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button
            type='button'
            variant={includeBothDimensions ? 'default' : 'outline'}
            size='sm'
            aria-pressed={includeBothDimensions}
            onClick={() => setIncludeBothDimensions((value) => !value)}
          >
            {t('Model + Channel')}
          </Button>
        </div>
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
          <FlowUserTokenFilters
            users={legendUsers}
            selectedTokensByUser={selectedTokensByUser}
            onUserTokensChange={handleUserTokenSelectionChange}
          />
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
                <EmptyDescription>
                  {t('No matching token and channel usage was found.')}
                </EmptyDescription>
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
