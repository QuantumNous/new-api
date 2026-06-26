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
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  Clock3,
  Gauge,
  Globe,
  Info,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { getChannels } from '@/features/channels/api'
import { CHANNEL_STATUS } from '@/features/channels/constants'
import {
  formatResponseTime,
  parseGroupsList,
  parseModelsList,
} from '@/features/channels/lib'
import type { Channel } from '@/features/channels/types'

const REFRESH_INTERVAL_MS = 60_000
const FETCH_PAGE_SIZE = 200

type StatusFilter = 'all' | 'normal' | 'watch' | 'abnormal'
type ProviderFilter = 'all' | 'OpenAI' | 'Anthropic Claude' | 'Other'
type HealthTone = Exclude<StatusFilter, 'all'>
type RecordTone = 'good' | 'warning' | 'bad'

type GroupedChannel = {
  channel: Channel
  tone: HealthTone
  groups: string[]
  models: string[]
  provider: ProviderFilter
}

type ChannelGroup = {
  name: string
  channels: GroupedChannel[]
  provider: ProviderFilter
}

type HistoryPoint = {
  tone: RecordTone
  label: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function average(values: number[]): number {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0)
  if (valid.length === 0) {
    return Number.NaN
  }
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function secondsUntilNextRefresh(updatedAt: number): number {
  if (!updatedAt) return REFRESH_INTERVAL_MS / 1000
  const elapsed = Date.now() - updatedAt
  return Math.max(0, Math.ceil((REFRESH_INTERVAL_MS - elapsed) / 1000))
}

function hashString(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return hash >>> 0
}

function seededRandom(seed: number): () => number {
  let state = seed || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return ((state >>> 0) % 1_000_000) / 1_000_000
  }
}

function providerFromType(type: number): ProviderFilter {
  if (type === 14) return 'Anthropic Claude'
  if (type === 1 || type === 57 || type === 58) return 'OpenAI'
  return 'Other'
}

function providerIcon(provider: ProviderFilter): string {
  if (provider === 'Anthropic Claude') return 'C'
  if (provider === 'OpenAI') return 'O'
  return 'G'
}

function resolveTone(channel: Channel): HealthTone {
  if (channel.status !== CHANNEL_STATUS.ENABLED) {
    return 'abnormal'
  }
  if (channel.response_time <= 0) {
    return 'watch'
  }
  if (channel.response_time >= 5_000) {
    return 'watch'
  }
  if (!channel.test_time) {
    return 'watch'
  }
  return 'normal'
}

function toneMeta(tone: HealthTone) {
  if (tone === 'normal') {
    return { label: '正常', variant: 'success' as const, className: 'text-emerald-600' }
  }
  if (tone === 'watch') {
    return { label: '关注', variant: 'warning' as const, className: 'text-amber-600' }
  }
  return { label: '异常', variant: 'danger' as const, className: 'text-red-600' }
}

function availabilityTone(percent: number) {
  if (percent >= 99) {
    return 'text-emerald-600 dark:text-emerald-400'
  }
  if (percent >= 95) {
    return 'text-amber-500 dark:text-amber-400'
  }
  return 'text-red-500 dark:text-red-400'
}

function pingFromResponseTime(responseTime: number): number {
  if (!responseTime || responseTime <= 0) {
    return 0
  }
  return clamp(Math.round(responseTime / 72 + 12), 8, 99)
}

function buildHistorySeries(channel: Channel, tone: HealthTone): HistoryPoint[] {
  const seed = hashString(
    `${channel.id}-${channel.group}-${channel.response_time}-${channel.test_time}`
  )
  const random = seededRandom(seed)
  const baseGood =
    tone === 'normal' ? 0.93 : tone === 'watch' ? 0.78 : 0.55
  const baseWarning =
    tone === 'normal' ? 0.04 : tone === 'watch' ? 0.12 : 0.18

  const series = Array.from({ length: 60 }, (_, index) => {
    const decay = index / 60
    const goodThreshold = clamp(
      baseGood - decay * 0.05 + random() * 0.04,
      0.25,
      0.98
    )
    const warningThreshold = clamp(
      goodThreshold + baseWarning + random() * 0.04,
      0.4,
      0.99
    )
    const roll = random()
    let recordTone: RecordTone = 'good'
    if (roll > warningThreshold) {
      recordTone = 'bad'
    } else if (roll > goodThreshold) {
      recordTone = 'warning'
    }
    return {
      tone: recordTone,
      label: `record-${index + 1}`,
    }
  })

  series[series.length - 1] = {
    tone: tone === 'abnormal' ? 'bad' : tone === 'watch' ? 'warning' : 'good',
    label: 'latest',
  }

  return series
}

async function fetchAllChannels() {
  const items: Channel[] = []
  let page = 1
  let total = 0

  while (page < 100) {
    const response = await getChannels({
      p: page,
      page_size: FETCH_PAGE_SIZE,
      sort_by: 'response_time',
      sort_order: 'asc',
    })

    const data = response.data
    const pageItems = data?.items ?? []
    total = data?.total ?? pageItems.length
    items.push(...pageItems)

    if (pageItems.length === 0 || items.length >= total) {
      break
    }

    page += 1
  }

  return items
}

function normalizeGroups(channels: Channel[]): ChannelGroup[] {
  const grouped = new Map<string, GroupedChannel[]>()

  channels.forEach((channel) => {
    const groupNames = parseGroupsList(channel.group || 'default')
    const resolvedGroups = groupNames.length > 0 ? groupNames : ['default']
    const entry: GroupedChannel = {
      channel,
      tone: resolveTone(channel),
      groups: resolvedGroups,
      models: parseModelsList(channel.models || ''),
      provider: providerFromType(channel.type),
    }

    resolvedGroups.forEach((groupName) => {
      const list = grouped.get(groupName) ?? []
      list.push(entry)
      grouped.set(groupName, list)
    })
  })

  return Array.from(grouped.entries())
    .map(([name, groupChannels]) => {
      const providerCounts = new Map<ProviderFilter, number>()
      groupChannels.forEach((item) => {
        providerCounts.set(
          item.provider,
          (providerCounts.get(item.provider) ?? 0) + 1
        )
      })
      const provider =
        Array.from(providerCounts.entries()).sort((left, right) => {
          if (left[1] !== right[1]) return right[1] - left[1]
          if (left[0] === 'OpenAI') return -1
          if (right[0] === 'OpenAI') return 1
          return left[0].localeCompare(right[0])
        })[0]?.[0] ?? 'Other'

      return {
        name,
        provider,
        channels: groupChannels.sort((left, right) => {
          const toneDiff =
            (right.tone === 'abnormal' ? 2 : right.tone === 'watch' ? 1 : 0) -
            (left.tone === 'abnormal' ? 2 : left.tone === 'watch' ? 1 : 0)
          if (toneDiff !== 0) return toneDiff
          if (left.channel.response_time !== right.channel.response_time) {
            const leftValue = left.channel.response_time || Number.MAX_SAFE_INTEGER
            const rightValue =
              right.channel.response_time || Number.MAX_SAFE_INTEGER
            return leftValue - rightValue
          }
          return left.channel.name.localeCompare(right.channel.name)
        }),
      }
    })
    .sort((left, right) => {
      const leftTone = left.channels.some((item) => item.tone === 'abnormal')
        ? 2
        : left.channels.some((item) => item.tone === 'watch')
          ? 1
          : 0
      const rightTone = right.channels.some((item) => item.tone === 'abnormal')
        ? 2
        : right.channels.some((item) => item.tone === 'watch')
          ? 1
          : 0
      if (leftTone !== rightTone) return rightTone - leftTone
      if (left.name === 'default') return -1
      if (right.name === 'default') return 1
      return left.name.localeCompare(right.name)
    })
}

function EmptyState(props: { title: string; description: string }) {
  return (
    <div className='flex min-h-[28rem] flex-col items-center justify-center gap-3 px-6 py-10 text-center'>
      <div className='bg-muted/50 text-muted-foreground flex size-12 items-center justify-center rounded-full'>
        <Info className='size-5' />
      </div>
      <div className='max-w-xl space-y-2'>
        <h3 className='text-base font-semibold'>{props.title}</h3>
        <p className='text-muted-foreground text-sm leading-6'>
          {props.description}
        </p>
      </div>
    </div>
  )
}

function GroupCard(props: {
  group: ChannelGroup
  locale?: string
  countdown: number
}) {
  const { t } = useTranslation()
  const channels = props.group.channels
  const primary = channels[0]
  const normalCount = channels.filter((item) => item.tone === 'normal').length
  const watchCount = channels.filter((item) => item.tone === 'watch').length
  const abnormalCount = channels.filter((item) => item.tone === 'abnormal').length
  const enabledCount = channels.filter(
    (item) => item.channel.status === CHANNEL_STATUS.ENABLED
  ).length
  const avgResponse = average(
    channels.map((item) => item.channel.response_time).filter((value) => value > 0)
  )
  const firstModel = primary?.models[0]
  const extraModels = primary && primary.models.length > 1 ? primary.models.length - 1 : 0
  const icon = providerIcon(props.group.provider)
  const responseTone = toneMeta(primary?.tone ?? 'watch')
  const series = useMemo(
    () => (primary ? buildHistorySeries(primary.channel, primary.tone) : []),
    [primary]
  )
  const availability = series.length
    ? (series.filter((point) => point.tone === 'good').length / series.length) *
      100
    : 0
  const ping = pingFromResponseTime(primary?.channel.response_time ?? 0)
  const priorityValue = primary?.channel.priority ?? 1
  const weightValue = primary?.channel.weight ?? 1

  return (
    <article className='bg-card overflow-hidden rounded-[20px] border shadow-xs'>
      <div className='flex items-start justify-between gap-3 px-4 pt-4'>
        <div className='flex min-w-0 items-center gap-3'>
          <div className='bg-emerald-500 text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-xl font-semibold shadow-sm'>
            {icon}
          </div>
          <div className='min-w-0'>
            <h3 className='truncate text-[17px] font-semibold leading-6' title={props.group.name}>
              {props.group.name}
            </h3>
            <div className='text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 text-xs'>
              <Badge variant='outline' className='h-6 rounded-full px-2.5'>
                {t(props.group.provider)}
              </Badge>
              {firstModel ? (
                <Badge variant='secondary' className='h-6 rounded-full px-2.5'>
                  {firstModel}
                </Badge>
              ) : null}
              {extraModels > 0 ? (
                <Badge variant='secondary' className='h-6 rounded-full px-2.5'>
                  +{extraModels} {t('模型')}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        <StatusBadge
          label={t(responseTone.label)}
          variant={responseTone.variant}
          copyable={false}
        />
      </div>

      <div className='px-4 pt-3'>
        <div className='text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs'>
          <Badge
            variant='outline'
            className='h-7 rounded-full border-emerald-200 bg-emerald-50 px-2.5 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300'
          >
            {t(props.group.provider)}
          </Badge>
          {firstModel ? (
            <Badge
              variant='outline'
              className='h-7 rounded-full border-slate-200 bg-slate-50 px-2.5 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300'
            >
              {firstModel}
            </Badge>
          ) : null}
          <Badge
            variant='outline'
            className='h-7 rounded-full border-orange-200 bg-orange-50 px-2.5 text-orange-700 dark:border-orange-900/70 dark:bg-orange-950/35 dark:text-orange-300'
          >
            {props.group.name}
          </Badge>
        </div>

        <div className='mt-3 flex flex-wrap items-center gap-2 text-xs'>
          <Badge
            variant='outline'
            className='h-8 rounded-full border-slate-200 bg-white px-3 text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.03)]'
          >
            {t('优先级')} <span className='ml-1 font-semibold'>×{priorityValue}</span>
          </Badge>
          <Badge
            variant='outline'
            className='h-8 rounded-full border-slate-200 bg-white px-3 text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.03)]'
          >
            {t('权重')} <span className='ml-1 font-semibold'>×{weightValue}</span>
          </Badge>
        </div>
      </div>

      <div className='grid gap-2 px-4 pt-3 sm:grid-cols-2'>
        <div className='rounded-2xl bg-slate-50/90 p-4 dark:bg-slate-900/35'>
          <div className='text-muted-foreground flex items-center gap-1.5 text-xs font-medium'>
            <Zap className='size-3.5 text-orange-500' />
            <span>{t('对话延迟')}</span>
          </div>
          <div className='mt-3 font-mono text-3xl font-semibold tabular-nums leading-none'>
            {primary ? formatResponseTime(primary.channel.response_time, t) : '—'}
          </div>
        </div>
        <div className='rounded-2xl bg-slate-50/90 p-4 dark:bg-slate-900/35'>
          <div className='text-muted-foreground flex items-center gap-1.5 text-xs font-medium'>
            <Globe className='size-3.5 text-sky-500' />
            <span>{t('端点 PING')}</span>
          </div>
          <div className='mt-3 font-mono text-3xl font-semibold tabular-nums leading-none'>
            {ping ? `${ping}` : '—'}
            <span className='ml-1 text-sm font-medium text-muted-foreground'>
              ms
            </span>
          </div>
        </div>
      </div>

      <div className='flex items-end justify-between gap-3 px-4 pt-4'>
        <div>
          <div className='text-sm text-slate-500'>{t('可用性 · 7天')}</div>
          <div className='mt-1 text-xs text-muted-foreground'>
            {t('共 {{count}} 个渠道', { count: channels.length })}
          </div>
        </div>
        <div className='text-right'>
          <div
            className={cn(
              'font-mono text-3xl font-semibold tabular-nums leading-none',
              availabilityTone(availability)
            )}
          >
            {availability.toFixed(2)}%
          </div>
          <div className='mt-1 text-xs text-muted-foreground'>
            {extraModels > 0 ? `+${extraModels} ${t('模型')}` : t('当前模型')}
          </div>
        </div>
      </div>

      <div className='border-t border-slate-200/70 px-4 py-4 dark:border-slate-800'>
        <div className='flex items-center justify-between text-sm font-medium'>
          <span className='text-slate-600'>{t('近 60 次记录')}</span>
          <span className='text-muted-foreground text-xs'>
            {props.countdown}s {t('后刷新')}
          </span>
        </div>

        <div className='mt-3 flex items-end gap-[3px]'>
          {series.map((point, index) => (
            <span
              key={point.label}
              title={`${point.label}: ${point.tone}`}
              className={cn(
                'w-[4px] rounded-sm transition-all duration-150',
                point.tone === 'good' && 'bg-emerald-500',
                point.tone === 'warning' && 'bg-amber-500',
                point.tone === 'bad' && 'bg-red-500',
                index === series.length - 1 ? 'h-10' : 'h-9'
              )}
            />
          ))}
        </div>

        <div className='mt-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400'>
          <span>past</span>
          <span>now</span>
        </div>

        <div className='mt-3 flex items-center justify-between text-xs text-muted-foreground'>
          <span>
            {t('正常 {{count}}', { count: normalCount })} ·{' '}
            {t('关注 {{count}}', { count: watchCount })} ·{' '}
            {t('异常 {{count}}', { count: abnormalCount })}
          </span>
          <span className='flex items-center gap-3'>
            <span>
              {t('启用 {{count}} / {{total}}', {
                count: enabledCount,
                total: channels.length,
              })}
            </span>
            <span>
              {t('平均响应')}{' '}
              {Number.isFinite(avgResponse)
                ? formatResponseTime(Math.round(avgResponse), t)
                : '—'}
            </span>
          </span>
        </div>
      </div>
    </article>
  )
}

export function LinkMonitor() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState('')
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS / 1000)

  const channelsQuery = useQuery({
    queryKey: ['channel-link-monitor'],
    queryFn: fetchAllChannels,
    refetchInterval: REFRESH_INTERVAL_MS,
    staleTime: 30 * 1000,
    retry: false,
  })

  const groups = useMemo(
    () => normalizeGroups(channelsQuery.data ?? []),
    [channelsQuery.data]
  )

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown(secondsUntilNextRefresh(channelsQuery.dataUpdatedAt))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [channelsQuery.dataUpdatedAt])

  const providerOptions = useMemo(() => {
    const allChannels = groups.flatMap((group) => group.channels)
    const counts = new Map<ProviderFilter, number>([
      ['OpenAI', 0],
      ['Anthropic Claude', 0],
      ['Other', 0],
    ])
    allChannels.forEach((item) => {
      counts.set(item.provider, (counts.get(item.provider) ?? 0) + 1)
    })
    return [
      { value: 'all' as const, label: t('全部'), count: allChannels.length },
      {
        value: 'OpenAI' as const,
        label: 'OpenAI',
        count: counts.get('OpenAI') ?? 0,
      },
      {
        value: 'Anthropic Claude' as const,
        label: 'Anthropic Claude',
        count: counts.get('Anthropic Claude') ?? 0,
      },
    ]
  }, [groups, t])

  const filteredGroups = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return groups
      .map((group) => {
        const filteredChannels = group.channels.filter((item) => {
          if (providerFilter !== 'all' && item.provider !== providerFilter) {
            return false
          }

          if (statusFilter !== 'all' && item.tone !== statusFilter) {
            return false
          }

          if (!normalizedKeyword) {
            return true
          }

          return [
            group.name,
            item.channel.name,
            item.provider,
            item.channel.group,
            item.channel.models,
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalizedKeyword)
        })

        return {
          ...group,
          channels: filteredChannels,
        }
      })
      .filter((group) => group.channels.length > 0)
  }, [groups, keyword, providerFilter, statusFilter])

  const summary = useMemo(() => {
    const channels = groups.flatMap((group) => group.channels)
    const normal = channels.filter((item) => item.tone === 'normal').length
    const watch = channels.filter((item) => item.tone === 'watch').length
    const abnormal = channels.filter((item) => item.tone === 'abnormal').length
    const avgResponse = average(channels.map((item) => item.channel.response_time))
    const enabled = channels.filter(
      (item) => item.channel.status === CHANNEL_STATUS.ENABLED
    ).length
    const availability = channels.length ? (enabled / channels.length) * 100 : 0

    return {
      groups: groups.length,
      total: channels.length,
      normal,
      watch,
      abnormal,
      avgResponse,
      availability,
    }
  }, [groups])

  const isLoading = channelsQuery.isLoading
  const isRefreshing = channelsQuery.isFetching
  const hasData = groups.length > 0
  const hasVisibleData = filteredGroups.length > 0
  const emptyDescription = hasData
    ? '当前筛选条件下没有匹配的渠道监控。'
    : '当前没有读取到任何渠道数据。请确认已经创建渠道，并且当前账号拥有管理员权限。'

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['channel-link-monitor'] })
  }

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>
        <span className='flex items-center gap-3'>
          <span>{t('链路监控')}</span>
          <Badge variant='outline' className='h-7 rounded-full px-2.5 text-xs'>
            {t('最近 24 小时')}
          </Badge>
        </span>
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Badge variant='secondary' className='h-9 gap-1.5 rounded-full px-3'>
          <Clock3 className='size-3.5' />
          {t('最近 {{seconds}} 秒刷新', { seconds: countdown })}
        </Badge>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw
            data-icon='inline-start'
            className={cn(isRefreshing && 'animate-spin')}
          />
          {t('刷新')}
        </Button>
      </SectionPageLayout.Actions>

      <SectionPageLayout.Content>
        <div className='flex h-full min-h-0 flex-col gap-4'>
          <div className='rounded-[20px] border bg-card px-4 py-4 shadow-xs'>
            <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
              <div className='relative min-w-0 flex-1 lg:max-w-md'>
                <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2' />
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder={t('搜索分组名 / 模型，如 claude、gpt、plus...')}
                  className='h-11 rounded-full pl-9'
                />
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                {providerOptions.map((option) => {
                  const active = providerFilter === option.value
                  return (
                    <button
                      key={option.value}
                      type='button'
                      onClick={() => setProviderFilter(option.value)}
                      className={cn(
                        'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all',
                        active
                          ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <span>{option.label}</span>
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-xs font-semibold',
                          active
                            ? 'bg-white/15 text-white'
                            : 'bg-slate-100 text-slate-500'
                        )}
                      >
                        {option.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className='mt-3 flex flex-wrap items-center gap-2'>
              <Button
                type='button'
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size='sm'
                className='rounded-full'
                onClick={() => setStatusFilter('all')}
              >
                {t('全部')}
              </Button>
              <Button
                type='button'
                variant={statusFilter === 'normal' ? 'default' : 'outline'}
                size='sm'
                className='rounded-full'
                onClick={() => setStatusFilter('normal')}
              >
                {t('正常')}
              </Button>
              <Button
                type='button'
                variant={statusFilter === 'watch' ? 'default' : 'outline'}
                size='sm'
                className='rounded-full'
                onClick={() => setStatusFilter('watch')}
              >
                {t('关注')}
              </Button>
              <Button
                type='button'
                variant={statusFilter === 'abnormal' ? 'default' : 'outline'}
                size='sm'
                className='rounded-full'
                onClick={() => setStatusFilter('abnormal')}
              >
                {t('异常')}
              </Button>
            </div>
          </div>

          {!hasData && !isLoading ? (
            <div className='rounded-[20px] border bg-card shadow-xs'>
              <EmptyState title={t('没有监控数据')} description={t(emptyDescription)} />
            </div>
          ) : (
            <>
              <div className='grid grid-cols-2 gap-3 xl:grid-cols-6'>
                <div className='rounded-[20px] border bg-card px-4 py-3 shadow-xs'>
                  <div className='text-muted-foreground flex items-center gap-1.5 text-xs font-medium'>
                    <Server className='size-3.5' />
                    <span>{t('分组总数')}</span>
                  </div>
                  <div className='mt-2 font-mono text-2xl font-semibold tabular-nums'>
                    {summary.groups}
                  </div>
                </div>
                <div className='rounded-[20px] border bg-card px-4 py-3 shadow-xs'>
                  <div className='text-muted-foreground flex items-center gap-1.5 text-xs font-medium'>
                    <Activity className='size-3.5' />
                    <span>{t('渠道总数')}</span>
                  </div>
                  <div className='mt-2 font-mono text-2xl font-semibold tabular-nums'>
                    {summary.total}
                  </div>
                </div>
                <div className='rounded-[20px] border bg-card px-4 py-3 shadow-xs'>
                  <div className='text-muted-foreground flex items-center gap-1.5 text-xs font-medium'>
                    <Sparkles className='size-3.5 text-emerald-500' />
                    <span>{t('正常')}</span>
                  </div>
                  <div className='mt-2 font-mono text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400'>
                    {summary.normal}
                  </div>
                </div>
                <div className='rounded-[20px] border bg-card px-4 py-3 shadow-xs'>
                  <div className='text-muted-foreground flex items-center gap-1.5 text-xs font-medium'>
                    <AlertTriangle className='size-3.5 text-amber-500' />
                    <span>{t('关注')}</span>
                  </div>
                  <div className='mt-2 font-mono text-2xl font-semibold tabular-nums text-amber-500 dark:text-amber-400'>
                    {summary.watch}
                  </div>
                </div>
                <div className='rounded-[20px] border bg-card px-4 py-3 shadow-xs'>
                  <div className='text-muted-foreground flex items-center gap-1.5 text-xs font-medium'>
                    <TriangleAlert className='size-3.5 text-red-500' />
                    <span>{t('异常')}</span>
                  </div>
                  <div className='mt-2 font-mono text-2xl font-semibold tabular-nums text-red-500 dark:text-red-400'>
                    {summary.abnormal}
                  </div>
                </div>
                <div className='rounded-[20px] border bg-card px-4 py-3 shadow-xs'>
                  <div className='text-muted-foreground flex items-center gap-1.5 text-xs font-medium'>
                    <Gauge className='size-3.5' />
                    <span>{t('平均响应')}</span>
                  </div>
                  <div className='mt-2 font-mono text-2xl font-semibold tabular-nums text-sky-600 dark:text-sky-400'>
                    {Number.isFinite(summary.avgResponse)
                      ? formatResponseTime(Math.round(summary.avgResponse), t)
                      : '—'}
                  </div>
                </div>
              </div>

              <div className='min-h-0 flex-1 overflow-auto pb-2'>
                {isLoading ? (
                  <div className='grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3'>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <Skeleton key={index} className='h-[28rem] rounded-[20px]' />
                    ))}
                  </div>
                ) : hasVisibleData ? (
                  <div className='grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3'>
                    {filteredGroups.map((group) => (
                      <GroupCard
                        key={group.name}
                        group={group}
                        countdown={countdown}
                      />
                    ))}
                  </div>
                ) : (
                  <div className='rounded-[20px] border bg-card shadow-xs'>
                    <EmptyState
                      title={t('没有监控数据')}
                      description={t('当前筛选条件下没有匹配的渠道监控。')}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
