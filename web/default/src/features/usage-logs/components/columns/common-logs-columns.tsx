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
import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { CircleAlert, Sparkles, KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import {
  formatBillingAmountForOpsCenter,
  formatLogQuotaForOpsCenter,
} from '@/lib/ops-billing-display'
import { formatUseTime, formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge, type StatusBadgeProps } from '@/components/status-badge'
import type { UsageLog } from '../../data/schema'
import {
  formatLogContentSummaryForDisplay,
  formatModelName,
  getFirstResponseTimeColor,
  getResponseTimeColor,
  getTieredBillingSummary,
  hasAnyCacheTokens,
  parseLogOther,
  isViolationFeeLog,
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
import { useUsageLogsContext } from '../usage-logs-provider'
import {
  usageLogsColumnHeaderClassName,
  usageLogsDetailSummaryClass,
  usageLogsInlinePillClass,
  usageLogsLogTypeBadgeClass,
  usageLogsTableEmptyClass,
  usageLogsTableMetaClass,
  usageLogsTablePrimaryClass,
} from './column-helpers'

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

function getGroupRatioText(other: LogOtherData | null): string | null {
  const userGroupRatio = other?.user_group_ratio
  if (
    userGroupRatio != null &&
    userGroupRatio !== -1 &&
    Number.isFinite(userGroupRatio)
  ) {
    return `${formatRatioCompact(userGroupRatio)}x`
  }

  const groupRatio = other?.group_ratio
  if (groupRatio != null && groupRatio !== 1 && Number.isFinite(groupRatio)) {
    return `${formatRatioCompact(groupRatio)}x`
  }

  return null
}

function buildDetailSegments(
  log: UsageLog,
  other: LogOtherData | null,
  t: (key: string, opts?: Record<string, unknown>) => string
): DetailSegment[] {
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
      text: `${t('usageLogs.label.quota_amount')}: ${formatLogQuotaForOpsCenter(other?.fee_quota ?? log.quota)}`,
      muted: true,
    })
    return segments
  }

  if (!other) return []

  const segments: DetailSegment[] = []

  const priceOpts = { digitsLarge: 4, digitsSmall: 6, abbreviate: false }
  const formatPrice = (price: number) =>
    `${formatBillingAmountForOpsCenter(price, priceOpts)}/M`
  const formatPriceCompact = (price: number) =>
    formatBillingAmountForOpsCenter(price, priceOpts)
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
    const isPerCall = isPerCallBilling(other.model_price)
    if (isPerCall) {
      segments.push({
        text: `${t('Per-call')} · ${formatBillingAmountForOpsCenter(other.model_price!, priceOpts)}`,
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
  const columns: ColumnDef<UsageLog>[] = [
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('usageLogs.col.time')}
          className={usageLogsColumnHeaderClassName}
        />
      ),
      cell: ({ row }) => {
        const log = row.original
        const timestamp = row.getValue('created_at') as number
        const config = getLogTypeConfig(log.type)

        return (
          <div className='flex flex-col gap-0.5'>
            <span
              className={cn(
                'font-mono text-xs tabular-nums',
                usageLogsTablePrimaryClass
              )}
            >
              {formatTimestampToDate(timestamp)}
            </span>
            <StatusBadge
              label={t(config.label)}
              variant={config.color as StatusBadgeProps['variant']}
              size='sm'
              copyable={false}
              className={usageLogsLogTypeBadgeClass}
            />
          </div>
        )
      },
      filterFn: (row, _id, value) => {
        if (!value || value.length === 0) return true
        return value.includes(String(row.original.type))
      },
      enableHiding: false,
      meta: { label: t('usageLogs.col.time') },
    },
  ]

  if (isAdmin) {
    columns.push(
      {
        id: 'channel',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t('usageLogs.col.channel')}
            className={usageLogsColumnHeaderClassName}
          />
        ),
        cell: function ChannelCell({ row }) {
          const { sensitiveVisible, setAffinityTarget, setAffinityDialogOpen } =
            useUsageLogsContext()
          const log = row.original

          if (!isDisplayableLogType(log.type)) return null

          const other = parseLogOther(log.other)
          const affinity = other?.admin_info?.channel_affinity
          const useChannel = other?.admin_info?.use_channel
          const channelChain =
            useChannel && useChannel.length > 0
              ? useChannel.join(' → ')
              : undefined
          const channelDisplay = log.channel_name
            ? `${log.channel_name} #${log.channel}`
            : `#${log.channel}`
          const channelIdDisplay = `#${log.channel}`
          const channelName = sensitiveVisible ? log.channel_name : '••••'

          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <div className='flex max-w-[160px] flex-col gap-0.5' />
                  }
                >
                  <div className='relative inline-flex w-fit'>
                    <StatusBadge
                      label={channelIdDisplay}
                      autoColor={String(log.channel)}
                      copyText={String(log.channel)}
                      size='sm'
                      className='font-mono'
                    />
                    {affinity && (
                      <button
                        type='button'
                        className='absolute -top-1 -right-1 leading-none text-amber-500'
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
                    <span className={cn(usageLogsTableMetaClass, 'truncate')}>
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
                      <p className={usageLogsTableMetaClass}>
                        {t('Chain')}: {channelChain}
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
        meta: { label: t('usageLogs.col.channel'), mobileHidden: true },
      },
      {
        id: 'user',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t('usageLogs.col.account')}
            className={usageLogsColumnHeaderClassName}
          />
        ),
        cell: function UserCell({ row }) {
          const { sensitiveVisible, setSelectedUserId, setUserInfoDialogOpen } =
            useUsageLogsContext()
          const log = row.original

          if (!log.username) return null

          return (
            <button
              type='button'
              className='flex items-center gap-1.5 text-left'
              aria-label={t('usageLogs.userDialog.view_account')}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedUserId(log.user_id)
                setUserInfoDialogOpen(true)
              }}
            >
              <Avatar className='ring-border/60 size-6 ring-1'>
                <AvatarFallback
                  className={cn(
                    'text-[11px] font-semibold',
                    !sensitiveVisible && 'bg-muted text-muted-foreground'
                  )}
                  style={
                    sensitiveVisible
                      ? getUserAvatarStyle(log.username)
                      : undefined
                  }
                >
                  {sensitiveVisible ? getUserAvatarFallback(log.username) : '•'}
                </AvatarFallback>
              </Avatar>
              <TooltipProvider delay={300}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span
                        className={cn(
                          'max-w-[100px] truncate text-sm font-semibold hover:underline',
                          usageLogsTablePrimaryClass
                        )}
                      />
                    }
                  >
                    {sensitiveVisible ? log.username : '••••'}
                  </TooltipTrigger>
                  {sensitiveVisible && log.username.length > 12 && (
                    <TooltipContent side='top'>
                      {log.username}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </button>
          )
        },
        meta: { label: t('usageLogs.col.account'), mobileHidden: true },
      }
    )
  }

  columns.push({
    accessorKey: 'token_name',
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={t('usageLogs.col.access_key')}
        className={usageLogsColumnHeaderClassName}
      />
    ),
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

      const metaParts: string[] = []
      const groupRatioText = getGroupRatioText(other)
      if (group) {
        metaParts.push(sensitiveVisible ? group : '••••')
      }
      if (groupRatioText) metaParts.push(groupRatioText)

      return (
        <div className='flex max-w-[200px] flex-col gap-0.5'>
          <TooltipProvider delay={300}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <div className='max-w-full' />
                }
              >
                <StatusBadge
                  label={displayName}
                  icon={KeyRound}
                  copyText={sensitiveVisible ? tokenName : undefined}
                  size='sm'
                  showDot={false}
                  className={cn(
                    'max-w-full overflow-hidden font-medium',
                    usageLogsInlinePillClass
                  )}
                />
              </TooltipTrigger>
              {sensitiveVisible && tokenName.length > 16 && (
                <TooltipContent side='top' className='max-w-xs break-all'>
                  {tokenName}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          {metaParts.length > 0 && (
            <span className={cn(usageLogsTableMetaClass, 'truncate')}>
              {metaParts.join(' · ')}
            </span>
          )}
        </div>
      )
    },
    meta: { label: t('usageLogs.col.access_key') },
    size: 160,
  })

  columns.push(
    {
      accessorKey: 'model_name',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('usageLogs.col.model')}
          className={usageLogsColumnHeaderClassName}
        />
      ),
      cell: function ModelCell({ row }) {
        const log = row.original
        if (!isDisplayableLogType(log.type)) return null

        const modelInfo = formatModelName(log)

        return (
          <div className='flex max-w-[220px] flex-col gap-0.5'>
            <ModelBadge
              modelName={modelInfo.name}
              actualModel={modelInfo.actualModel}
            />
          </div>
        )
      },
      meta: { label: t('usageLogs.col.model'), mobileTitle: true },
    },

    {
      accessorKey: 'use_time',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('usageLogs.col.timing')}
          className={usageLogsColumnHeaderClassName}
        />
      ),
      cell: ({ row }) => {
        const log = row.original
        if (!isTimingLogType(log.type)) return null

        const useTime = row.getValue('use_time') as number
        const other = parseLogOther(log.other)
        const frt = other?.frt
        const tokensPerSecond =
          useTime > 0 && log.completion_tokens > 0
            ? log.completion_tokens / useTime
            : null
        const timeVariant = getResponseTimeColor(useTime, log.completion_tokens)
        const frtVariant = frt ? getFirstResponseTimeColor(frt / 1000) : null

        const pillBg: Record<string, string> = {
          success: 'border border-emerald-500/30 bg-emerald-500/10',
          warning: 'border border-amber-500/30 bg-amber-500/10',
          danger: 'border border-rose-500/30 bg-rose-500/10',
        }
        const pillText: Record<string, string> = {
          success: 'text-emerald-400',
          warning: 'text-amber-400',
          danger: 'text-rose-400',
        }
        const pillDot: Record<string, string> = {
          success: 'bg-emerald-500/80',
          warning: 'bg-amber-500/80',
          danger: 'bg-rose-500/80',
        }

        return (
          <div className='flex flex-col gap-1'>
            <div className='flex items-center gap-1.5'>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-xs font-medium',
                  pillBg[timeVariant],
                  pillText[timeVariant]
                )}
              >
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    pillDot[timeVariant]
                  )}
                  aria-hidden='true'
                />
                {formatUseTime(useTime)}
              </span>
              {log.is_stream &&
                (frt != null && frt > 0 ? (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-xs font-medium',
                      pillBg[frtVariant!],
                      pillText[frtVariant!]
                    )}
                  >
                    {formatUseTime(frt / 1000)}
                  </span>
                ) : (
                  <span className={cn('text-xs', usageLogsInlinePillClass)}>
                    N/A
                  </span>
                ))}
            </div>
            <div className='flex items-center gap-1 text-xs'>
              <span className={usageLogsTableMetaClass}>
                {log.is_stream ? t('Stream') : t('Non-stream')}
                {tokensPerSecond != null && (
                  <>
                    {' · '}
                    <span className='font-mono tabular-nums'>
                      {Math.round(tokensPerSecond)}
                    </span>
                    {' t/s'}
                  </>
                )}
              </span>
              {log.is_stream &&
                other?.stream_status &&
                other.stream_status.status !== 'ok' && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger
                        render={<CircleAlert className='size-3 text-red-500' />}
                      ></TooltipTrigger>
                      <TooltipContent>
                        <div className='space-y-0.5 text-xs'>
                          <p>
                            {t('Stream Status')}: {t('Error')}
                          </p>
                          <p>{other.stream_status.end_reason || 'unknown'}</p>
                          {(other.stream_status.error_count ?? 0) > 0 && (
                            <p>
                              {t('Soft Errors')}:{' '}
                              {other.stream_status.error_count}
                            </p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
            </div>
          </div>
        )
      },
      meta: { label: t('usageLogs.col.timing'), mobileHidden: true },
    },

    {
      accessorKey: 'prompt_tokens',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('usageLogs.col.input_output')}
          className={usageLogsColumnHeaderClassName}
        />
      ),
      cell: ({ row }) => {
        const log = row.original
        if (!isDisplayableLogType(log.type)) return null

        const other = parseLogOther(log.other)

        const promptTokens = log.prompt_tokens || 0
        const completionTokens = log.completion_tokens || 0
        if (promptTokens === 0 && completionTokens === 0) {
          return (
            <span className={usageLogsTableEmptyClass}>-</span>
          )
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
            <span
              className={cn(
                'font-mono text-xs font-semibold tabular-nums',
                usageLogsTablePrimaryClass
              )}
            >
              {promptTokens.toLocaleString()} /{' '}
              {completionTokens.toLocaleString()}
            </span>
            {(cacheReadTokens > 0 || cacheWriteTokens > 0) && (
              <div className='flex items-center gap-1 text-xs'>
                {cacheReadTokens > 0 && (
                  <span className={usageLogsTableMetaClass}>
                    {t('Cache')}↓ {cacheReadTokens.toLocaleString()}
                  </span>
                )}
                {cacheWriteTokens > 0 && (
                  <span className={usageLogsTableMetaClass}>
                    ↑ {cacheWriteTokens.toLocaleString()}
                  </span>
                )}
              </div>
            )}
          </div>
        )
      },
      meta: { label: t('usageLogs.col.input_output'), mobileHidden: true },
    },

    {
      accessorKey: 'quota',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('usageLogs.col.quota_consumption')}
          className={usageLogsColumnHeaderClassName}
        />
      ),
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
                    <span className='inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' />
                  }
                >
                  <span
                    className='size-1.5 rounded-full bg-emerald-500'
                    aria-hidden='true'
                  />
                  {t('Subscription')}
                </TooltipTrigger>
                <TooltipContent>
                  <span>
                    {t('Deducted by subscription')}: {formatLogQuotaForOpsCenter(quota)}
                  </span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        }

        const quotaStr = formatLogQuotaForOpsCenter(quota)

        return (
          <div className='flex flex-col gap-0.5'>
            <span
              className={cn(
                'w-fit font-semibold tabular-nums',
                usageLogsInlinePillClass
              )}
            >
              {quotaStr}
            </span>
          </div>
        )
      },
      meta: { label: t('usageLogs.col.quota_consumption') },
    },

    {
      accessorKey: 'content',
      header: t('usageLogs.col.details'),
      cell: function DetailsCell({ row }) {
        const [dialogOpen, setDialogOpen] = useState(false)
        const log = row.original
        const other = parseLogOther(log.other)

        const segments = buildDetailSegments(log, other, t)
        const primary = segments[0]
        const hasMore = segments.length > 1
        const summaryText = primary
          ? formatLogContentSummaryForDisplay(primary.text, log.type)
          : log.content
            ? formatLogContentSummaryForDisplay(log.content, log.type)
            : null

        return (
          <>
            <button
              type='button'
              className='group flex max-w-[200px] items-center gap-1 text-left'
              onClick={() => setDialogOpen(true)}
              title={t('Click to view full details')}
            >
              {summaryText ? (
                <span
                  className={cn(
                    'truncate group-hover:underline',
                    usageLogsDetailSummaryClass,
                    primary?.muted && 'text-slate-400',
                    primary?.danger && 'text-red-400'
                  )}
                >
                  {summaryText}
                  {hasMore && (
                    <span className='ml-0.5 text-slate-400'>
                      +{segments.length - 1}
                    </span>
                  )}
                </span>
              ) : (
                <span className={usageLogsTableEmptyClass}>—</span>
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
      meta: { label: t('usageLogs.col.details') },
      size: 180,
      maxSize: 200,
    }
  )

  return columns
}
