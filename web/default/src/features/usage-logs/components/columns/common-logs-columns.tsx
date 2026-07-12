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
import type { ColumnDef } from '@tanstack/react-table'
import { GitBranch, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { GroupBadge } from '@/components/group-badge'
import { CopyableStatusBadge, StatusBadge } from '@/components/status-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useGroupRatios } from '@/hooks/use-group-ratios'
import { getUserAvatarFallback, getUserAvatarProps } from '@/lib/avatar'
import { getIdentityTextColorClass } from '@/lib/colors'
import { formatBillingCurrencyFromUSD } from '@/lib/currency'
import { formatLogQuota, formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'

import { LOG_TYPE_ALL_VALUE } from '../../constants'
import type { UsageLog } from '../../data/schema'
import {
  formatModelName,
  getTieredBillingSummary,
  hasAnyCacheTokens,
  parseLogOther,
  isViolationFeeLog,
  renderAuditContent,
} from '../../lib/format'
import {
  isDisplayableLogType,
  isTimingLogType,
  getLogTypeConfig,
  isPerCallBilling,
} from '../../lib/utils'
import type { LogOtherData } from '../../types'
import { DetailsDialog } from '../dialogs/details-dialog'
import { ModelBadge } from '../model-badge'
import { TimingMetricsCell, StreamTpsCell } from '../timing-metrics-cell'
import { useUsageLogsContext } from '../usage-logs-provider'

interface DetailSegment {
  text: string
  muted?: boolean
  danger?: boolean
}

function formatRatioCompact(ratio: number | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return '-'
  return ratio % 1 === 0
    ? String(ratio)
    : ratio.toFixed(4).replace(/\.?0+$/, '')
}

function getGroupRatioText(
  other: LogOtherData | null,
  configuredGroupRatio?: number
): string | null {
  const userGroupRatio = other?.user_group_ratio
  if (
    userGroupRatio != null &&
    userGroupRatio !== -1 &&
    Number.isFinite(userGroupRatio)
  ) {
    return `${formatRatioCompact(userGroupRatio)}x`
  }

  const groupRatio = other?.group_ratio ?? configuredGroupRatio
  if (groupRatio != null && Number.isFinite(groupRatio)) {
    return `${formatRatioCompact(groupRatio)}x`
  }

  return null
}

function buildDetailSegments(
  log: UsageLog,
  other: LogOtherData | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
  isAdmin: boolean
): DetailSegment[] {
  const segments = buildTypeDetailSegments(log, other, t)
  // Quota saturation is a rare, admin-only anomaly marker; surface it first
  // and in danger styling so it stands out on the related billing log. The
  // backend already strips admin_info for non-admins; gate on isAdmin too as
  // defense in depth so the marker never leaks if that changes.
  if (isAdmin && other?.admin_info?.quota_saturation) {
    return [{ text: t('Quota clamped'), danger: true }, ...segments]
  }
  return segments
}

function buildTypeDetailSegments(
  log: UsageLog,
  other: LogOtherData | null,
  t: (key: string, opts?: Record<string, unknown>) => string
): DetailSegment[] {
  // Audit (type=3) and login (type=7) logs: render localized content from the
  // structured op descriptor instead of the raw (English-fallback) content.
  if (log.type === 3 || log.type === 7) {
    const text = renderAuditContent(other, t)
    return text ? [{ text }] : []
  }

  if (log.type === 6) {
    return [{ text: t('Async task refund') }]
  }

  if (log.type !== 2) return []

  const isViolation = isViolationFeeLog(other)
  if (isViolation) {
    const segments: DetailSegment[] = []
    segments.push({ text: t('Violation Fee'), danger: true })
    if (other?.violation_fee_code) {
      segments.push({
        text: other.violation_fee_code,
        muted: true,
      })
    }
    segments.push({
      text: `${t('Fee')}: ${formatLogQuota(other?.fee_quota ?? log.quota)}`,
      muted: true,
    })
    return segments
  }

  if (!other) return []

  const segments: DetailSegment[] = []

  const priceOpts = { digitsLarge: 4, digitsSmall: 6, abbreviate: false }
  const formatPrice = (price: number) =>
    `${formatBillingCurrencyFromUSD(price, priceOpts)}/M`
  const formatPriceCompact = (price: number) =>
    formatBillingCurrencyFromUSD(price, priceOpts)
  const formatPriceList = (prices: string[], showUnit: boolean) => {
    const text = prices.join(' / ')
    return showUnit ? `${text}/M` : text
  }
  const isTieredExpr = other.billing_mode === 'tiered_expr'
  const tieredSummary = getTieredBillingSummary(other)
  if (isTieredExpr) {
    if (tieredSummary) {
      const baseEntries = tieredSummary.priceEntries
        .filter((entry) => ['inputPrice', 'outputPrice'].includes(entry.field))
        .map((entry) => formatPriceCompact(entry.price))
      if (baseEntries.length > 0) {
        const tierLabel = tieredSummary.tier.label || t('Default')
        segments.push({
          text: `${tierLabel} · ${formatPriceList(baseEntries, true)}`,
        })
      }

      const cacheEntries = tieredSummary.priceEntries
        .filter((entry) =>
          ['cacheReadPrice', 'cacheCreatePrice', 'cacheCreate1hPrice'].includes(
            entry.field
          )
        )
        .map((entry) => {
          return formatPriceCompact(entry.price)
        })
      if (cacheEntries.length > 0) {
        segments.push({
          text: `${t('Cache')} ${formatPriceList(cacheEntries, false)}`,
          muted: true,
        })
      }

      const otherEntries = tieredSummary.priceEntries
        .filter(
          (entry) =>
            ![
              'inputPrice',
              'outputPrice',
              'cacheReadPrice',
              'cacheCreatePrice',
              'cacheCreate1hPrice',
            ].includes(entry.field)
        )
        .map((entry) => `${t(entry.shortLabel)} ${formatPrice(entry.price)}`)
      if (otherEntries.length > 0) {
        segments.push({
          text: otherEntries.join(' · '),
          muted: true,
        })
      }
    } else {
      segments.push({
        text: `${t('Dynamic Pricing')} · ${t('No matching results')}`,
        muted: true,
      })
    }
  } else {
    const modelPrice = other.model_price
    if (modelPrice != null && isPerCallBilling(modelPrice)) {
      segments.push({
        text: `${t('Per-call')} · ${formatBillingCurrencyFromUSD(modelPrice, priceOpts)}`,
      })
    } else if (other.model_ratio != null) {
      const inputPriceUSD = other.model_ratio * 2.0
      const baseEntries = [formatPriceCompact(inputPriceUSD)]
      if (other.completion_ratio != null) {
        baseEntries.push(
          formatPriceCompact(inputPriceUSD * other.completion_ratio)
        )
      }
      segments.push({
        text: `${t('Standard')} · ${formatPriceList(baseEntries, true)}`,
      })

      if (hasAnyCacheTokens(other)) {
        const cacheEntries = [
          other.cache_ratio != null && other.cache_ratio !== 1
            ? formatPriceCompact(inputPriceUSD * other.cache_ratio)
            : null,
          other.cache_creation_ratio != null && other.cache_creation_ratio !== 1
            ? formatPriceCompact(inputPriceUSD * other.cache_creation_ratio)
            : null,
          other.cache_creation_ratio_1h != null &&
          other.cache_creation_ratio_1h !== 0
            ? formatPriceCompact(inputPriceUSD * other.cache_creation_ratio_1h)
            : null,
        ].filter(Boolean) as string[]

        if (cacheEntries.length > 0) {
          segments.push({
            text: `${t('Cache')} ${formatPriceList(cacheEntries, false)}`,
            muted: true,
          })
        }
      }
    } else {
      const userGroupRatio = other.user_group_ratio
      const groupRatio = other.group_ratio
      const isUserGroup =
        userGroupRatio != null &&
        Number.isFinite(userGroupRatio) &&
        userGroupRatio !== -1
      const effectiveRatio = isUserGroup ? userGroupRatio : groupRatio
      const ratioLabel = isUserGroup
        ? t('User Exclusive Ratio')
        : t('Group Ratio')

      if (effectiveRatio != null && Number.isFinite(effectiveRatio)) {
        segments.push({
          text: `${ratioLabel} ${formatRatioCompact(effectiveRatio)}x`,
        })
      }
    }
  }

  if (other.is_system_prompt_overwritten) {
    segments.push({
      text: t('System Prompt Override'),
      danger: true,
    })
  }

  return segments
}

export function useCommonLogsColumns(isAdmin: boolean): ColumnDef<UsageLog>[] {
  const { t } = useTranslation()
  const groupRatios = useGroupRatios()
  const columns: ColumnDef<UsageLog>[] = [
    {
      accessorKey: 'created_at',
      header: t('Time'),
      cell: ({ row }) => {
        const log = row.original
        const timestamp = row.getValue('created_at') as number
        const config = getLogTypeConfig(log.type)

        return (
          <div className='flex min-w-0 flex-col gap-0.5'>
            <span className='text-xs tabular-nums'>
              {formatTimestampToDate(timestamp)}
            </span>
            <StatusBadge variant={config.variant} size='sm'>
              {t(config.label)}
            </StatusBadge>
          </div>
        )
      },
      filterFn: (row, _id, value) => {
        if (!Array.isArray(value) || value.length === 0) return true
        if (value.includes(LOG_TYPE_ALL_VALUE)) return true
        return value.includes(String(row.original.type))
      },
      enableHiding: false,
      size: 180,
      meta: {
        cardRole: 'primary',
        cardOrder: 10,
        contentMode: 'full',
      },
    },
  ]

  if (isAdmin) {
    columns.push(
      {
        id: 'channel',
        header: t('Channel'),
        accessorFn: (row) => row.channel,
        cell: function ChannelCell({ row }) {
          const { sensitiveVisible, setAffinityTarget, setAffinityDialogOpen } =
            useUsageLogsContext()
          const log = row.original

          if (!isDisplayableLogType(log.type)) return null

          const other = parseLogOther(log.other)
          const affinity = other?.admin_info?.channel_affinity
          const rawUseChannel = other?.admin_info?.use_channel ?? []
          const useChannel = Array.isArray(rawUseChannel)
            ? rawUseChannel.map(String).filter(Boolean)
            : []
          const hasRetryChain = useChannel.length > 1
          const channelChain = hasRetryChain
            ? useChannel.join(' → ')
            : undefined
          // Inline variant is compact (no spaces) so three hops fit the
          // 160px cell; longer chains collapse the middle, keeping the
          // first hops and the final channel. Full chain stays in the
          // tooltip below.
          let channelChainInline: string | undefined
          if (hasRetryChain) {
            channelChainInline =
              useChannel.length > 3
                ? `${useChannel[0]}→${useChannel[1]}→…→${useChannel.at(-1)}`
                : useChannel.join('→')
          }
          const channelDisplay = log.channel_name
            ? `${log.channel_name} #${log.channel}`
            : `#${log.channel}`
          const channelIdDisplay = `#${log.channel}`
          const channelName = sensitiveVisible ? log.channel_name : '••••'
          const multiKeyIndex = other?.admin_info?.multi_key_index
          const showMultiKeyIndex =
            other?.admin_info?.is_multi_key === true &&
            typeof multiKeyIndex === 'number' &&
            Number.isFinite(multiKeyIndex)

          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <div className='flex max-w-[160px] flex-col gap-0.5' />
                  }
                >
                  <div className='relative inline-flex w-fit max-w-full items-center gap-1'>
                    <CopyableStatusBadge
                      value={String(log.channel)}
                      variant='neutral'
                      size='sm'
                      className={cn(
                        'font-mono',
                        getIdentityTextColorClass(String(log.channel))
                      )}
                    >
                      {channelIdDisplay}
                    </CopyableStatusBadge>
                    {showMultiKeyIndex && (
                      <StatusBadge
                        size='sm'
                        variant='neutral'
                        className='min-w-5 justify-center font-mono'
                        aria-label={`${t('Key')} ${multiKeyIndex}`}
                      >
                        {multiKeyIndex}
                      </StatusBadge>
                    )}
                    {hasRetryChain && (
                      <span className='text-subtle-foreground inline-flex min-w-0 items-center gap-0.5 text-xs'>
                        <GitBranch
                          className='size-3 shrink-0'
                          aria-hidden='true'
                        />
                        <span className='truncate font-mono tabular-nums'>
                          {channelChainInline}
                        </span>
                      </span>
                    )}
                    {affinity && (
                      <button
                        type='button'
                        className='text-warning absolute -top-1 -right-1 leading-none'
                        onClick={(e) => {
                          e.stopPropagation()
                          setAffinityTarget({
                            rule_name: affinity.rule_name || '',
                            using_group:
                              affinity.using_group ||
                              affinity.selected_group ||
                              '',
                            key_hint: affinity.key_hint || '',
                            key_fp: affinity.key_fp || '',
                          })
                          setAffinityDialogOpen(true)
                        }}
                      >
                        <Sparkles className='size-3 fill-current' />
                      </button>
                    )}
                  </div>
                  {log.channel_name && (
                    <span className='text-subtle-foreground truncate text-xs'>
                      {channelName}
                    </span>
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  <div className='space-y-1'>
                    <p>
                      {sensitiveVisible ? channelDisplay : channelIdDisplay}
                    </p>
                    {channelChain && (
                      <p className='text-muted-foreground text-xs'>
                        {t('Chain')}: {channelChain}
                      </p>
                    )}
                    {showMultiKeyIndex && (
                      <p className='text-muted-foreground text-xs'>
                        {t('Key')}: {multiKeyIndex}
                      </p>
                    )}
                    {affinity && (
                      <div className='border-t pt-1 text-xs'>
                        <p className='font-medium'>{t('Channel Affinity')}</p>
                        <p>
                          {t('Rule')}: {affinity.rule_name || '-'}
                        </p>
                        <p>
                          {t('Group')}:{' '}
                          {sensitiveVisible
                            ? affinity.using_group ||
                              affinity.selected_group ||
                              '-'
                            : '••••'}
                        </p>
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        },
        meta: {
          cardRole: 'primary',
          cardOrder: 20,
          contentMode: 'wrap',
        },
      },
      {
        id: 'user',
        header: t('User'),
        accessorFn: (row) => row.username,
        cell: function UserCell({ row }) {
          const { sensitiveVisible, setSelectedUserId, setUserInfoDialogOpen } =
            useUsageLogsContext()
          const log = row.original

          if (!log.username) return null

          const avatarProps = sensitiveVisible
            ? getUserAvatarProps(log.username)
            : undefined

          return (
            <button
              type='button'
              className='flex items-center gap-1.5 text-left'
              onClick={(e) => {
                e.stopPropagation()
                setSelectedUserId(log.user_id)
                setUserInfoDialogOpen(true)
              }}
            >
              <Avatar className='size-6 max-sm:hidden'>
                <AvatarFallback
                  className={cn(
                    'text-xs font-semibold',
                    avatarProps?.className
                  )}
                  style={avatarProps?.style}
                >
                  {sensitiveVisible ? getUserAvatarFallback(log.username) : '•'}
                </AvatarFallback>
              </Avatar>
              <TooltipProvider delay={300}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className='text-muted-foreground max-w-[100px] truncate text-sm hover:underline' />
                    }
                  >
                    {sensitiveVisible ? log.username : '••••'}
                  </TooltipTrigger>
                  {sensitiveVisible && log.username.length > 12 && (
                    <TooltipContent side='top'>{log.username}</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </button>
          )
        },
        meta: {
          cardRole: 'primary',
          cardOrder: 30,
          contentMode: 'wrap',
        },
      }
    )
  }

  columns.push({
    accessorKey: 'token_name',
    header: t('Token'),
    cell: function TokenNameCell({ row }) {
      const { sensitiveVisible } = useUsageLogsContext()
      const log = row.original
      if (!isDisplayableLogType(log.type)) return null

      const tokenName = log.token_name
      if (!tokenName) return null

      const other = parseLogOther(log.other)
      const displayName = sensitiveVisible ? tokenName : '••••'
      let group = log.group
      if (!group) group = other?.group || ''

      // The ratio reveals the group's pricing, so it hides together with
      // the group name when sensitive info is masked.
      const groupRatioText = sensitiveVisible
        ? getGroupRatioText(other, group ? groupRatios[group] : undefined)
        : null
      const tokenBadgeClassName =
        'max-w-full min-w-0 overflow-hidden [&>[data-slot=status-badge-label]]:max-w-full [&>[data-slot=status-badge-label]]:min-w-0 [&>[data-slot=status-badge-label]]:overflow-hidden [&>[data-slot=status-badge-label]]:text-ellipsis'

      return (
        <div className='flex max-w-[200px] flex-col gap-0.5'>
          <TooltipProvider delay={300}>
            <Tooltip>
              <TooltipTrigger render={<div className='max-w-full' />}>
                {sensitiveVisible ? (
                  <CopyableStatusBadge
                    value={tokenName}
                    variant='neutral'
                    size='sm'
                    className={tokenBadgeClassName}
                  >
                    {displayName}
                  </CopyableStatusBadge>
                ) : (
                  <StatusBadge
                    variant='neutral'
                    size='sm'
                    className={tokenBadgeClassName}
                  >
                    {displayName}
                  </StatusBadge>
                )}
              </TooltipTrigger>
              {sensitiveVisible && tokenName.length > 16 && (
                <TooltipContent side='top' className='max-w-xs break-all'>
                  {tokenName}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          {(group || groupRatioText) && (
            <span className='flex max-w-full min-w-0 items-baseline gap-1 text-xs leading-none'>
              {group && (
                <GroupBadge
                  group={group}
                  label={sensitiveVisible ? undefined : '••••'}
                  size='sm'
                  className='min-w-0 truncate'
                />
              )}
              {groupRatioText && (
                <span className='text-subtle-foreground shrink-0 tabular-nums'>
                  {groupRatioText}
                </span>
              )}
            </span>
          )}
        </div>
      )
    },
    size: 160,
    meta: {
      cardRole: 'primary',
      cardOrder: 40,
      cardSpan: 2,
      // 'summary' (not 'full') so the group/ratio meta line can truncate
      // instead of overflowing or wrapping to extra rows.
      contentMode: 'summary',
    },
  })
  columns.push(
    {
      accessorKey: 'model_name',
      header: t('Model'),
      cell: function ModelCell({ row }) {
        const log = row.original
        if (!isDisplayableLogType(log.type)) return null

        const modelInfo = formatModelName(log)

        return (
          <div className='flex w-fit flex-col gap-0.5'>
            <ModelBadge
              modelName={modelInfo.name}
              actualModel={modelInfo.actualModel}
            />
          </div>
        )
      },
      size: 180,
      meta: {
        cardRole: 'title',
        cardSpan: 2,
        contentMode: 'full',
      },
    },
    {
      accessorKey: 'is_stream',
      header: t('Stream'),
      cell: ({ row }) => {
        const log = row.original
        if (!isTimingLogType(log.type)) return null

        const useTime = row.getValue('use_time') as number
        const other = parseLogOther(log.other)
        const tokensPerSecond =
          useTime > 0 && log.completion_tokens > 0
            ? log.completion_tokens / useTime
            : null

        return (
          <StreamTpsCell
            isStream={log.is_stream}
            tokensPerSecond={tokensPerSecond}
            streamStatus={other?.stream_status}
          />
        )
      },
      meta: {
        label: t('Stream'),
        cardRole: 'primary',
        cardOrder: 50,
        contentMode: 'full',
      },
    },
    {
      accessorKey: 'use_time',
      header: t('Timing'),
      cell: ({ row }) => {
        const log = row.original
        if (!isTimingLogType(log.type)) return null

        const useTime = row.getValue('use_time') as number
        const other = parseLogOther(log.other)

        return (
          <TimingMetricsCell
            useTimeSec={useTime}
            completionTokens={log.completion_tokens}
            frtMs={other?.frt}
            isStream={log.is_stream}
          />
        )
      },
      meta: {
        cardRole: 'primary',
        cardOrder: 55,
        contentMode: 'full',
      },
    },
    {
      accessorKey: 'prompt_tokens',
      header: 'Tokens',
      cell: ({ row }) => {
        const log = row.original
        if (!isDisplayableLogType(log.type)) return null

        const other = parseLogOther(log.other)

        const promptTokens = log.prompt_tokens || 0
        const completionTokens = log.completion_tokens || 0
        if (promptTokens === 0 && completionTokens === 0) {
          return <span className='text-muted-foreground text-xs'>-</span>
        }

        const cacheReadTokens = other?.cache_tokens || 0
        const cacheWrite5m = other?.cache_creation_tokens_5m || 0
        const cacheWrite1h = other?.cache_creation_tokens_1h || 0
        const hasSplitCache = cacheWrite5m > 0 || cacheWrite1h > 0
        const cacheWriteTokens = hasSplitCache
          ? cacheWrite5m + cacheWrite1h
          : other?.cache_creation_tokens || 0

        return (
          <div className='flex flex-col gap-0.5'>
            <span className='text-xs font-medium tabular-nums'>
              {promptTokens.toLocaleString()} /{' '}
              {completionTokens.toLocaleString()}
            </span>
            {(cacheReadTokens > 0 || cacheWriteTokens > 0) && (
              <div className='flex items-center gap-1 text-xs'>
                {cacheReadTokens > 0 && (
                  <span className='text-subtle-foreground'>
                    {t('Cache')}↓ {cacheReadTokens.toLocaleString()}
                  </span>
                )}
                {cacheWriteTokens > 0 && (
                  <span className='text-subtle-foreground'>
                    ↑ {cacheWriteTokens.toLocaleString()}
                  </span>
                )}
              </div>
            )}
          </div>
        )
      },
      meta: {
        cardRole: 'primary',
        cardOrder: 60,
        cardSpan: 2,
        contentMode: 'full',
      },
    },
    {
      accessorKey: 'quota',
      header: t('Cost'),
      cell: ({ row }) => {
        const log = row.original
        if (!isDisplayableLogType(log.type)) return null

        const quota = row.getValue('quota') as number
        const other = parseLogOther(log.other)
        const isSubscription = other?.billing_source === 'subscription'

        if (isSubscription) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className='text-success cursor-help text-sm font-medium' />
                  }
                >
                  {t('Subscription')}
                </TooltipTrigger>
                <TooltipContent>
                  <span>
                    {t('Deducted by subscription')}: {formatLogQuota(quota)}
                  </span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        }

        return (
          <span className='text-sm font-medium tabular-nums'>
            {formatLogQuota(quota)}
          </span>
        )
      },
      meta: {
        cardRole: 'badge',
        contentMode: 'full',
      },
    },

    {
      accessorKey: 'content',
      header: t('Details'),
      cell: function DetailsCell({ row }) {
        const [dialogOpen, setDialogOpen] = useState(false)
        const log = row.original
        const other = parseLogOther(log.other)
        const ip = log.ip.trim()

        const segments = buildDetailSegments(log, other, t, isAdmin)
        const primary = segments[0]
        const hasMore = segments.length > 1
        let detailsContent = <span className='text-faint-foreground'>—</span>

        if (log.content) {
          detailsContent = (
            <span className='text-muted-foreground truncate group-hover:underline'>
              {log.content}
            </span>
          )
        }

        if (primary) {
          let primaryClassName = 'text-foreground'
          if (primary.muted) {
            primaryClassName = 'text-subtle-foreground'
          } else if (primary.danger) {
            primaryClassName = 'text-destructive'
          }

          detailsContent = (
            <span
              className={cn(
                'truncate leading-snug group-hover:underline',
                primaryClassName
              )}
            >
              {primary.text}
              {hasMore && (
                <span className='text-faint-foreground ml-0.5'>
                  +{segments.length - 1}
                </span>
              )}
            </span>
          )
        }

        return (
          <>
            <button
              type='button'
              className='group flex max-w-[200px] flex-col gap-0.5 text-left text-sm'
              onClick={() => setDialogOpen(true)}
              title={t('Click to view full details')}
            >
              {detailsContent}
              {ip && (
                <span className='text-subtle-foreground max-w-full truncate tabular-nums'>
                  {ip}
                </span>
              )}
            </button>
            <DetailsDialog
              log={log}
              isAdmin={isAdmin}
              open={dialogOpen}
              onOpenChange={setDialogOpen}
            />
          </>
        )
      },
      size: 180,
      maxSize: 200,
      meta: {
        pinned: 'right',
        contentSized: true,
        cardRole: 'secondary',
        cardOrder: 10,
        cardSpan: 2,
        contentMode: 'summary',
      },
    }
  )

  return columns
}
