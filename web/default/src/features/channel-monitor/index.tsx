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
  Analytics01Icon,
  ArrangeIcon,
  ChartLineData01Icon,
  HistoryIcon,
  Layers01Icon,
  Refresh01Icon,
  Search01Icon,
  Settings02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ChannelTestDialogForChannel } from '@/features/channels/components/dialogs/channel-test-dialog'
import { CHANNEL_STATUS } from '@/features/channels/constants'

import {
  fetchChannelMonitorUpstreamBalance,
  fetchChannelMonitorUpstreamRatio,
  getChannelMonitorOverview,
  getChannelMonitorPerformance,
  updateChannelMonitorSmartScheduleConfig,
  updateMonitoredChannelStatus,
} from './api'
import { ChannelMonitorChannelView } from './components/channel-monitor-channel-view'
import { ChannelMonitorGroupView } from './components/channel-monitor-group-view'
import { ChannelMonitorModelPerformanceView } from './components/channel-monitor-model-performance-view'
import { ChannelMonitorOrderDialog } from './components/channel-monitor-order-dialog'
import {
  ChannelMonitorSettingsDialog,
  type ChannelMonitorSettingsSection,
} from './components/channel-monitor-settings-dialog'
import { ChannelMonitorTaskHistoryDialog } from './components/channel-monitor-task-history-dialog'
import { ChannelRatioHistoryDialog } from './components/channel-ratio-history-dialog'
import { EditChannelGroupsDialog } from './components/edit-channel-groups-dialog'
import { EditChannelRatioDialog } from './components/edit-channel-ratio-dialog'
import { EditGroupRatioDialog } from './components/edit-group-ratio-dialog'
import { SyncGroupRatioDialog } from './components/sync-group-ratio-dialog'
import { UpstreamConfigDialog } from './components/upstream-config-dialog'
import { handleChannelMonitorMutationError } from './lib/error'
import { formatMonitorRatio, getRatioChange } from './lib/format'
import { sortChannelMonitorItems } from './lib/sort'
import type {
  ChannelMonitorChannelPerformance,
  ChannelMonitorItem,
  ChannelMonitorPerformanceMetric,
  ChannelMonitorPerformanceRangeMinutes,
  ChannelMonitorSettings,
  ChannelMonitorSortMode,
  ChannelMonitorUpstreamType,
  GroupMonitorItem,
} from './types'

type MonitorView = 'channels' | 'groups' | 'models'
type ChannelUpstreamFilter = 'all' | ChannelMonitorUpstreamType
type ChannelDialogType =
  | 'ratio'
  | 'groups'
  | 'upstream'
  | 'history'
  | 'connection_test'
type ChannelDialogState = {
  channelId: number
  type: ChannelDialogType
}

const EMPTY_CHANNELS: ChannelMonitorItem[] = []
const EMPTY_CHANNEL_ORDER: number[] = []
const EMPTY_GROUP_RATIOS: Record<string, number> = {}
const EMPTY_GROUP_COEFFICIENTS: Record<string, number> = {}
const EMPTY_PERFORMANCE_METRICS: ChannelMonitorPerformanceMetric[] = []
const DEFAULT_CHANNEL_MONITOR_SETTINGS: ChannelMonitorSettings = {
  auto_update_interval_minutes: 0,
  auto_update_retry_count: 2,
  email_notification_enabled: false,
  notification_email: '',
  smart_schedule_enabled: false,
  smart_schedule_interval_minutes: 10,
  smart_schedule_strategy: 'smart',
  smart_schedule_stability_enabled: false,
  smart_schedule_apply_mode: 'weight',
  smart_schedule_performance_minutes: 60,
  smart_schedule_model: '',
  smart_schedule_min_samples: 5,
}
const CHANNEL_MONITOR_SORT_STORAGE_KEY = 'channel-monitor:channel-sort'
const CHANNEL_MONITOR_SORT_OPTIONS: Array<{
  value: ChannelMonitorSortMode
  label: string
}> = [
  { value: 'custom', label: '自定义顺序' },
  { value: 'channel_asc', label: '渠道名称：升序' },
  { value: 'channel_desc', label: '渠道名称：降序' },
  { value: 'ratio_desc', label: '成本倍率：从高到低' },
  { value: 'ratio_asc', label: '成本倍率：从低到高' },
  { value: 'first_token_asc', label: '首字：从低到高' },
  { value: 'first_token_desc', label: '首字：从高到低' },
  { value: 'tps_desc', label: 'TPS：从高到低' },
  { value: 'tps_asc', label: 'TPS：从低到高' },
]
const CHANNEL_MONITOR_PERFORMANCE_RANGE_OPTIONS = [
  { value: '15', label: '近 15 分钟', shortLabel: '近15分钟' },
  { value: '60', label: '近 1 小时', shortLabel: '近1小时' },
  { value: '360', label: '近 6 小时', shortLabel: '近6小时' },
  { value: '1440', label: '近 24 小时', shortLabel: '近24小时' },
]

export function ChannelMonitor() {
  const queryClient = useQueryClient()
  const [view, setView] = useState<MonitorView>('channels')
  const [upstreamFilter, setUpstreamFilter] =
    useState<ChannelUpstreamFilter>('all')
  const [search, setSearch] = useState('')
  const [performanceRangeMinutes, setPerformanceRangeMinutes] =
    useState<ChannelMonitorPerformanceRangeMinutes>(15)
  const [performanceModelFilter, setPerformanceModelFilter] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] =
    useState<ChannelMonitorSettingsSection>('monitor')
  const [taskHistoryOpen, setTaskHistoryOpen] = useState(false)
  const [orderDialogOpen, setOrderDialogOpen] = useState(false)
  const [channelSortMode, setChannelSortMode] =
    useState<ChannelMonitorSortMode>(() => {
      const storedSortMode = localStorage.getItem(
        CHANNEL_MONITOR_SORT_STORAGE_KEY
      )
      switch (storedSortMode) {
        case 'custom':
        case 'channel_asc':
        case 'channel_desc':
        case 'ratio_asc':
        case 'ratio_desc':
        case 'first_token_asc':
        case 'first_token_desc':
        case 'tps_asc':
        case 'tps_desc':
          return storedSortMode
        default:
          return 'ratio_asc'
      }
    })
  const [channelDialog, setChannelDialog] = useState<ChannelDialogState | null>(
    null
  )
  const [editingGroup, setEditingGroup] = useState<GroupMonitorItem | null>(
    null
  )
  const [syncingGroup, setSyncingGroup] = useState<GroupMonitorItem | null>(
    null
  )

  const query = useQuery({
    queryKey: ['channel-monitor'],
    queryFn: getChannelMonitorOverview,
  })
  const performanceQuery = useQuery({
    queryKey: ['channel-monitor-performance', performanceRangeMinutes],
    queryFn: () => getChannelMonitorPerformance(performanceRangeMinutes),
    refetchInterval: 60_000,
  })
  const ratioFetchMutation = useMutation({
    mutationFn: fetchChannelMonitorUpstreamRatio,
    onError: handleChannelMonitorMutationError,
    onSuccess: (response, channelId) => {
      toast.success(
        `已获取上游倍率 ${formatMonitorRatio(response.data.result.ratio)}，成本倍率 ${formatMonitorRatio(response.data.result.cost_ratio)}`
      )
      queryClient.invalidateQueries({
        queryKey: ['channel-monitor-history', channelId],
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-monitor'] })
    },
  })
  const balanceFetchMutation = useMutation({
    mutationFn: fetchChannelMonitorUpstreamBalance,
    onError: handleChannelMonitorMutationError,
    onSuccess: (response) => {
      const balance = response.data.amount
      toast.success(
        balance == null
          ? '上游未返回余额'
          : `已更新上游余额：${balance.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 4,
            })}`
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-monitor'] })
    },
  })
  const statusMutation = useMutation({
    mutationFn: updateMonitoredChannelStatus,
    onError: handleChannelMonitorMutationError,
    onSuccess: (_response, request) => {
      toast.success(
        request.status === CHANNEL_STATUS.ENABLED ? '渠道已启用' : '渠道已禁用'
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-monitor'] })
      queryClient.invalidateQueries({ queryKey: ['channels'] })
    },
  })
  const smartScheduleConfigMutation = useMutation({
    mutationFn: updateChannelMonitorSmartScheduleConfig,
    onError: handleChannelMonitorMutationError,
    onSuccess: () => {
      toast.success('渠道调度设置已保存')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-monitor'] })
    },
  })
  const overview = query.data?.data
  const channels = overview?.channels ?? EMPTY_CHANNELS
  const channelOrder = overview?.channel_order ?? EMPTY_CHANNEL_ORDER
  const groupRatios = overview?.group_ratios ?? EMPTY_GROUP_RATIOS
  const groupCoefficients =
    overview?.group_coefficients ?? EMPTY_GROUP_COEFFICIENTS
  const settings = overview?.settings ?? DEFAULT_CHANNEL_MONITOR_SETTINGS
  const performanceMetrics =
    performanceQuery.data?.data.items ?? EMPTY_PERFORMANCE_METRICS
  const dialogChannel =
    channels.find((channel) => channel.id === channelDialog?.channelId) ?? null
  const autoUpdateIntervalMinutes = settings.auto_update_interval_minutes
  const autoUpdateLabel =
    autoUpdateIntervalMinutes > 0
      ? `自动更新：每 ${autoUpdateIntervalMinutes} 分钟 · 失败重试 ${settings.auto_update_retry_count} 次`
      : '自动更新：已关闭'
  const smartScheduleLabel = settings.smart_schedule_enabled
    ? `智能调度：每 ${settings.smart_schedule_interval_minutes} 分钟`
    : '智能调度：已关闭'
  const performanceRangeLabel =
    CHANNEL_MONITOR_PERFORMANCE_RANGE_OPTIONS.find(
      (option) => option.value === String(performanceRangeMinutes)
    )?.shortLabel ?? '近15分钟'

  const groups = useMemo<GroupMonitorItem[]>(() => {
    const groupNames = new Set(Object.keys(groupRatios))
    for (const channel of channels) {
      for (const group of channel.groups) groupNames.add(group)
    }
    return [...groupNames]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        name,
        ratio: groupRatios[name] ?? 1,
        coefficient: groupCoefficients[name] ?? 1,
        channels: channels.filter((channel) => channel.groups.includes(name)),
      }))
  }, [channels, groupCoefficients, groupRatios])

  const normalizedSearch = search.trim().toLocaleLowerCase()
  const matchingChannels = useMemo(
    () =>
      channels.filter((channel) => {
        if (
          upstreamFilter !== 'all' &&
          channel.upstream?.type !== upstreamFilter
        ) {
          return false
        }
        if (!normalizedSearch) return true
        return (
          channel.name.toLocaleLowerCase().includes(normalizedSearch) ||
          String(channel.id).includes(normalizedSearch) ||
          channel.groups.some((group) =>
            group.toLocaleLowerCase().includes(normalizedSearch)
          )
        )
      }),
    [channels, normalizedSearch, upstreamFilter]
  )
  const filteredGroups = useMemo(() => {
    if (!normalizedSearch) return groups
    return groups.filter(
      (group) =>
        group.name.toLocaleLowerCase().includes(normalizedSearch) ||
        group.channels.some((channel) =>
          channel.name.toLocaleLowerCase().includes(normalizedSearch)
        )
    )
  }, [groups, normalizedSearch])
  const performanceByChannel = useMemo(() => {
    type PerformanceAggregate = {
      sampleCount: number
      firstTokenSampleCount: number
      tpsSampleCount: number
      firstTokenTotalMs: number
      tpsTotal: number
      lastUsedTime: number
    }
    const aggregates = new Map<number, PerformanceAggregate>()
    for (const metric of performanceMetrics) {
      const aggregate = aggregates.get(metric.channel_id) ?? {
        sampleCount: 0,
        firstTokenSampleCount: 0,
        tpsSampleCount: 0,
        firstTokenTotalMs: 0,
        tpsTotal: 0,
        lastUsedTime: 0,
      }
      aggregate.sampleCount += metric.sample_count
      if (
        metric.average_first_token_ms != null &&
        metric.first_token_sample_count > 0
      ) {
        aggregate.firstTokenSampleCount += metric.first_token_sample_count
        aggregate.firstTokenTotalMs +=
          metric.average_first_token_ms * metric.first_token_sample_count
      }
      if (metric.average_tps != null && metric.tps_sample_count > 0) {
        aggregate.tpsSampleCount += metric.tps_sample_count
        aggregate.tpsTotal += metric.average_tps * metric.tps_sample_count
      }
      aggregate.lastUsedTime = Math.max(
        aggregate.lastUsedTime,
        metric.last_used_time
      )
      aggregates.set(metric.channel_id, aggregate)
    }

    const result = new Map<number, ChannelMonitorChannelPerformance>()
    for (const [channelId, aggregate] of aggregates) {
      result.set(channelId, {
        sample_count: aggregate.sampleCount,
        first_token_sample_count: aggregate.firstTokenSampleCount,
        tps_sample_count: aggregate.tpsSampleCount,
        average_first_token_ms:
          aggregate.firstTokenSampleCount > 0
            ? aggregate.firstTokenTotalMs / aggregate.firstTokenSampleCount
            : null,
        average_tps:
          aggregate.tpsSampleCount > 0
            ? aggregate.tpsTotal / aggregate.tpsSampleCount
            : null,
        last_used_time: aggregate.lastUsedTime,
      })
    }
    return result
  }, [performanceMetrics])
  const filteredChannels = useMemo(
    () =>
      sortChannelMonitorItems(
        matchingChannels,
        channelSortMode,
        channelOrder,
        performanceByChannel
      ),
    [channelOrder, channelSortMode, matchingChannels, performanceByChannel]
  )
  const performanceModelOptions = useMemo(
    () =>
      [...new Set(performanceMetrics.map((metric) => metric.model_name))]
        .sort((first, second) => first.localeCompare(second))
        .map((modelName) => ({ value: modelName, label: modelName })),
    [performanceMetrics]
  )
  const smartScheduleModelOptions = useMemo(() => {
    const models = new Set(
      performanceMetrics.map((metric) => metric.model_name).filter(Boolean)
    )
    for (const channel of channels) {
      for (const model of channel.models.split(',')) {
        const modelName = model.trim()
        if (modelName) models.add(modelName)
      }
    }
    if (settings.smart_schedule_model) {
      models.add(settings.smart_schedule_model)
    }
    return [...models].sort((first, second) => first.localeCompare(second))
  }, [channels, performanceMetrics, settings.smart_schedule_model])
  const activePerformanceModel = performanceModelOptions.some(
    (option) => option.value === performanceModelFilter
  )
    ? performanceModelFilter
    : (performanceModelOptions[0]?.value ?? '')

  const recordedCount = channels.filter(
    (channel) => channel.cost_ratio != null
  ).length
  const changedCount = channels.filter((channel) => {
    const change = getRatioChange(
      channel.cost_ratio,
      channel.previous_cost_ratio
    )
    return change.direction === 'up' || change.direction === 'down'
  }).length
  const newAPIChannelCount = channels.filter(
    (channel) => channel.upstream?.type === 'new_api'
  ).length
  const sub2APIChannelCount = channels.filter(
    (channel) => channel.upstream?.type === 'sub2api'
  ).length
  const customUpstreamChannelCount = channels.filter(
    (channel) => channel.upstream?.type === 'custom'
  ).length

  let pageContent: ReactNode
  if (query.isLoading) {
    pageContent = <ChannelMonitorSkeleton />
  } else if (query.isError) {
    pageContent = (
      <Empty className='min-h-80'>
        <EmptyHeader>
          <EmptyTitle>渠道监控加载失败</EmptyTitle>
          <EmptyDescription>请刷新后重试</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  } else {
    pageContent = (
      <div className='flex flex-col gap-4'>
        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          <MonitorStatCard
            label='全部渠道'
            value={channels.length}
            description='包含启用和禁用渠道'
            icon={Analytics01Icon}
          />
          <MonitorStatCard
            label='已记录倍率'
            value={recordedCount}
            description='已手动录入或从上游获取'
            icon={ChartLineData01Icon}
          />
          <MonitorStatCard
            label='发生变化'
            value={changedCount}
            description='相比上一条记录发生变化'
            icon={Refresh01Icon}
          />
          <MonitorStatCard
            label='本地分组'
            value={groups.length}
            description='当前可用的计费分组'
            icon={Layers01Icon}
          />
        </div>
        <Tabs
          value={view}
          onValueChange={(value) => setView(value as MonitorView)}
          className='gap-4'
        >
          <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
            <TabsList>
              <TabsTrigger value='channels'>
                <HugeiconsIcon
                  icon={Analytics01Icon}
                  data-icon='inline-start'
                />
                渠道 {channels.length}
              </TabsTrigger>
              <TabsTrigger value='groups'>
                <HugeiconsIcon icon={Layers01Icon} data-icon='inline-start' />
                分组 {groups.length}
              </TabsTrigger>
              <TabsTrigger value='models'>
                <HugeiconsIcon
                  icon={ChartLineData01Icon}
                  data-icon='inline-start'
                />
                模型性能 {performanceModelOptions.length}
              </TabsTrigger>
            </TabsList>

            <div className='flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:max-w-5xl lg:justify-end'>
              {view === 'channels' && (
                <ToggleGroup
                  value={[upstreamFilter]}
                  onValueChange={(values) => {
                    const nextValue = values.find(
                      (value) => value !== upstreamFilter
                    )
                    if (
                      nextValue !== 'all' &&
                      nextValue !== 'new_api' &&
                      nextValue !== 'sub2api' &&
                      nextValue !== 'custom'
                    ) {
                      return
                    }
                    setUpstreamFilter(nextValue)
                  }}
                  variant='outline'
                  size='sm'
                  spacing={0}
                  aria-label='按上游类型筛选渠道'
                  className='grid w-full grid-cols-2 sm:w-auto sm:grid-cols-4'
                >
                  <ToggleGroupItem value='all' className='w-full'>
                    全部 {channels.length}
                  </ToggleGroupItem>
                  <ToggleGroupItem value='new_api' className='w-full'>
                    New API {newAPIChannelCount}
                  </ToggleGroupItem>
                  <ToggleGroupItem value='sub2api' className='w-full'>
                    Sub2API {sub2APIChannelCount}
                  </ToggleGroupItem>
                  <ToggleGroupItem value='custom' className='w-full'>
                    自定义 {customUpstreamChannelCount}
                  </ToggleGroupItem>
                </ToggleGroup>
              )}

              {view === 'channels' && (
                <div className='flex w-full gap-2 sm:w-auto'>
                  <Select
                    items={CHANNEL_MONITOR_SORT_OPTIONS}
                    value={channelSortMode}
                    onValueChange={(value) => {
                      if (value === null) return
                      setChannelSortMode(value)
                      localStorage.setItem(
                        CHANNEL_MONITOR_SORT_STORAGE_KEY,
                        value
                      )
                    }}
                  >
                    <SelectTrigger
                      className='w-full sm:w-48'
                      aria-label='渠道排序方式'
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {CHANNEL_MONITOR_SORT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {channelSortMode === 'custom' && (
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => setOrderDialogOpen(true)}
                      className='shrink-0'
                    >
                      <HugeiconsIcon
                        icon={ArrangeIcon}
                        data-icon='inline-start'
                      />
                      调整顺序
                    </Button>
                  )}
                </div>
              )}

              {view === 'models' && (
                <div className='flex w-full gap-2 sm:w-auto'>
                  <Select
                    items={performanceModelOptions}
                    value={activePerformanceModel || null}
                    onValueChange={(value) => {
                      if (value !== null) setPerformanceModelFilter(value)
                    }}
                  >
                    <SelectTrigger
                      className='min-w-0 flex-1 sm:w-56'
                      aria-label='选择性能模型'
                      disabled={performanceModelOptions.length === 0}
                    >
                      <SelectValue placeholder='选择模型' />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {performanceModelOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Select
                    items={CHANNEL_MONITOR_PERFORMANCE_RANGE_OPTIONS}
                    value={String(performanceRangeMinutes)}
                    onValueChange={(value) => {
                      switch (value) {
                        case '15':
                          setPerformanceRangeMinutes(15)
                          break
                        case '60':
                          setPerformanceRangeMinutes(60)
                          break
                        case '360':
                          setPerformanceRangeMinutes(360)
                          break
                        case '1440':
                          setPerformanceRangeMinutes(1440)
                          break
                      }
                    }}
                  >
                    <SelectTrigger
                      className='w-36 shrink-0 sm:w-40'
                      aria-label='性能统计时间范围'
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {CHANNEL_MONITOR_PERFORMANCE_RANGE_OPTIONS.map(
                          (option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          )
                        )}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <InputGroup className='w-full sm:max-w-sm'>
                <InputGroupAddon>
                  <HugeiconsIcon icon={Search01Icon} />
                </InputGroupAddon>
                <InputGroupInput
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={
                    view === 'models' ? '搜索渠道' : '搜索渠道或分组'
                  }
                  aria-label={view === 'models' ? '搜索渠道' : '搜索渠道或分组'}
                />
              </InputGroup>
            </div>
          </div>

          <TabsContent value='channels'>
            <ChannelMonitorChannelView
              channels={filteredChannels}
              groupRatios={groupRatios}
              groupCoefficients={groupCoefficients}
              performanceByChannel={performanceByChannel}
              performanceRangeLabel={performanceRangeLabel}
              performanceLoading={performanceQuery.isLoading}
              performanceError={performanceQuery.isError}
              onFetchUpstreamBalance={(channel) =>
                balanceFetchMutation.mutate(channel.id)
              }
              onFetchUpstreamRatio={(channel) =>
                ratioFetchMutation.mutate(channel.id)
              }
              onTestConnection={(channel) =>
                setChannelDialog({
                  channelId: channel.id,
                  type: 'connection_test',
                })
              }
              onToggleStatus={(channel) =>
                statusMutation.mutate({
                  channelId: channel.id,
                  status:
                    channel.status === CHANNEL_STATUS.ENABLED
                      ? CHANNEL_STATUS.MANUAL_DISABLED
                      : CHANNEL_STATUS.ENABLED,
                })
              }
              onEditRatio={(channel) =>
                setChannelDialog({ channelId: channel.id, type: 'ratio' })
              }
              onEditGroups={(channel) =>
                setChannelDialog({ channelId: channel.id, type: 'groups' })
              }
              onConfigureUpstream={(channel) =>
                setChannelDialog({ channelId: channel.id, type: 'upstream' })
              }
              onViewHistory={(channel) =>
                setChannelDialog({ channelId: channel.id, type: 'history' })
              }
              onUpdateSmartSchedule={(channel, excluded) =>
                smartScheduleConfigMutation.mutate({
                  channelId: channel.id,
                  excluded,
                })
              }
              smartScheduleEnabled={settings.smart_schedule_enabled}
              fetchingBalanceChannelId={
                balanceFetchMutation.isPending
                  ? balanceFetchMutation.variables
                  : null
              }
              fetchingRatioChannelId={
                ratioFetchMutation.isPending
                  ? ratioFetchMutation.variables
                  : null
              }
              updatingStatusChannelId={
                statusMutation.isPending
                  ? (statusMutation.variables?.channelId ?? null)
                  : null
              }
              updatingSmartScheduleChannelId={
                smartScheduleConfigMutation.isPending
                  ? (smartScheduleConfigMutation.variables?.channelId ?? null)
                  : null
              }
            />
          </TabsContent>
          <TabsContent value='groups'>
            <ChannelMonitorGroupView
              groups={filteredGroups}
              onOpenScheduleSettings={() => {
                setSettingsSection('schedule')
                setSettingsOpen(true)
              }}
              onEditGroup={setEditingGroup}
              onSyncGroup={setSyncingGroup}
            />
          </TabsContent>
          <TabsContent value='models'>
            <ChannelMonitorModelPerformanceView
              key={activePerformanceModel}
              channels={channels}
              metrics={performanceMetrics}
              selectedModel={activePerformanceModel}
              search={search}
              isLoading={performanceQuery.isLoading}
              isError={performanceQuery.isError}
            />
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>渠道监控</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant='outline'
                  size='icon'
                  onClick={() => setTaskHistoryOpen(true)}
                  aria-label='定时任务记录'
                >
                  <HugeiconsIcon icon={HistoryIcon} />
                </Button>
              }
            />
            <TooltipContent>定时任务记录</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant='outline'
                  size='icon'
                  onClick={() => {
                    setSettingsSection('monitor')
                    setSettingsOpen(true)
                  }}
                  aria-label='渠道监控设置'
                >
                  <HugeiconsIcon icon={Settings02Icon} />
                </Button>
              }
            />
            <TooltipContent>
              {autoUpdateLabel}；{smartScheduleLabel}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant='outline'
                  size='icon'
                  onClick={() => {
                    query.refetch()
                    performanceQuery.refetch()
                  }}
                  disabled={query.isFetching || performanceQuery.isFetching}
                  aria-label='刷新'
                >
                  <HugeiconsIcon icon={Refresh01Icon} />
                </Button>
              }
            />
            <TooltipContent>刷新</TooltipContent>
          </Tooltip>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>{pageContent}</SectionPageLayout.Content>
      </SectionPageLayout>

      {dialogChannel && channelDialog?.type === 'ratio' && (
        <EditChannelRatioDialog
          key={dialogChannel.id}
          channel={dialogChannel}
          open
          onOpenChange={(open) => {
            if (!open) setChannelDialog(null)
          }}
        />
      )}
      {dialogChannel && channelDialog?.type === 'groups' && (
        <EditChannelGroupsDialog
          key={dialogChannel.id}
          channel={dialogChannel}
          open
          onOpenChange={(open) => {
            if (!open) setChannelDialog(null)
          }}
        />
      )}
      {dialogChannel && channelDialog?.type === 'upstream' && (
        <UpstreamConfigDialog
          key={dialogChannel.id}
          channel={dialogChannel}
          open
          onOpenChange={(open) => {
            if (!open) setChannelDialog(null)
          }}
        />
      )}
      {dialogChannel && channelDialog?.type === 'history' && (
        <ChannelRatioHistoryDialog
          key={dialogChannel.id}
          channel={dialogChannel}
          open
          onOpenChange={(open) => {
            if (!open) setChannelDialog(null)
          }}
        />
      )}
      {dialogChannel && channelDialog?.type === 'connection_test' && (
        <ChannelTestDialogForChannel
          channel={dialogChannel}
          open
          onOpenChange={(open) => {
            if (!open) setChannelDialog(null)
          }}
        />
      )}
      {editingGroup && (
        <EditGroupRatioDialog
          key={editingGroup.name}
          group={editingGroup}
          open
          onOpenChange={(open) => {
            if (!open) setEditingGroup(null)
          }}
        />
      )}
      {syncingGroup && (
        <SyncGroupRatioDialog
          key={`${syncingGroup.name}:${syncingGroup.coefficient}`}
          group={syncingGroup}
          open
          onOpenChange={(open) => {
            if (!open) setSyncingGroup(null)
          }}
        />
      )}
      {settingsOpen && (
        <ChannelMonitorSettingsDialog
          key={`${settingsSection}:${settings.auto_update_interval_minutes}:${settings.auto_update_retry_count}:${settings.email_notification_enabled}:${settings.notification_email}:${settings.smart_schedule_enabled}:${settings.smart_schedule_interval_minutes}:${settings.smart_schedule_strategy}:${settings.smart_schedule_stability_enabled}:${settings.smart_schedule_apply_mode}:${settings.smart_schedule_performance_minutes}:${settings.smart_schedule_model}:${settings.smart_schedule_min_samples}`}
          settings={settings}
          modelOptions={smartScheduleModelOptions}
          initialSection={settingsSection}
          open
          onOpenChange={setSettingsOpen}
        />
      )}
      {taskHistoryOpen && (
        <ChannelMonitorTaskHistoryDialog
          initialKind='ratio'
          open
          onOpenChange={setTaskHistoryOpen}
        />
      )}
      {orderDialogOpen && (
        <ChannelMonitorOrderDialog
          key={`${channels.length}:${channelOrder.join(',')}`}
          channels={channels}
          channelOrder={channelOrder}
          open
          onOpenChange={setOrderDialogOpen}
        />
      )}
    </>
  )
}

type MonitorStatCardProps = {
  label: string
  value: number
  description: string
  icon: React.ComponentProps<typeof HugeiconsIcon>['icon']
}

function MonitorStatCard(props: MonitorStatCardProps) {
  return (
    <Card size='sm'>
      <CardHeader>
        <CardDescription>{props.label}</CardDescription>
        <CardTitle className='text-2xl tabular-nums'>{props.value}</CardTitle>
        <CardAction>
          <span className='bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg'>
            <HugeiconsIcon icon={props.icon} />
          </span>
        </CardAction>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>
    </Card>
  )
}

function ChannelMonitorSkeleton() {
  return (
    <div className='flex flex-col gap-4'>
      <Skeleton className='h-9 w-full max-w-lg' />
      <Skeleton className='h-96 w-full rounded-lg' />
    </div>
  )
}
