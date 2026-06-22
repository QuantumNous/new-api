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
  formatUsageLogQuotaDisplay,
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
import { StatusBadge } from '@/components/status-badge'
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
import { LOG_TYPE_ENUM } from '../../constants'
import {
  isDisplayableLogType,
  isTimingLogType,
  getLogTypeConfig,
  isPerCallBilling,
} from '../../lib/utils'
import {
  usageLogsLogTypeBadgeBaseClassName,
  usageLogsMaskedAvatarClassName,
  usageLogsSubscriptionBadgeClassName,
  usageLogsTableBadgeMaxClassName,
  usageLogsTableClickableLinkClass,
  usageLogsTableFailReasonClass,
} from '../../lib/ops-ui-styles'
import type { LogOtherData } from '../../types'
import { DetailsDialog } from '../dialogs/details-dialog'
import { ModelBadge } from '../model-badge'
import { useUsageLogsContext } from '../usage-logs-provider'
import {
  usageLogsColumnHeaderClassName,
  usageLogsDetailSummaryClass,
  usageLogsInlinePillClass,
  usageLogsTableEmptyClass,
  usageLogsTableMetaClass,
  usageLogsTablePrimaryClass,
} from './column-helpers'

interface DetailSegment {
  text: string
  muted?: boolean
  danger?: boolean
}

const QUOTA_COLUMN_LOG_TYPES = new Set<number>([
  LOG_TYPE_ENUM.TOPUP,
  LOG_TYPE_ENUM.MANAGE,
  LOG_TYPE_ENUM.SYSTEM,
  LOG_TYPE_ENUM.REFUND,
])

function shouldShowQuotaColumn(type: number): boolean {
  return isDisplayableLogType(type) || QUOTA_COLUMN_LOG_TYPES.has(type)
}

const LOG_TYPE_LABEL_KEYS: Record<number, string> = {
  [LOG_TYPE_ENUM.UNKNOWN]: 'usageLogs.type.unknown',
  [LOG_TYPE_ENUM.TOPUP]: 'usageLogs.type.topup',
  [LOG_TYPE_ENUM.CONSUME]: 'usageLogs.type.consume',
  [LOG_TYPE_ENUM.MANAGE]: 'usageLogs.type.manage',
  [LOG_TYPE_ENUM.SYSTEM]: 'usageLogs.type.system',
  [LOG_TYPE_ENUM.ERROR]: 'usageLogs.type.error',
  [LOG_TYPE_ENUM.REFUND]: 'usageLogs.type.refund',
}

function usageLogTypeLabel(
  type: number,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  const key = LOG_TYPE_LABEL_KEYS[type]
  return key ? t(key) : t(getLogTypeConfig(type).label)
}

function usageLogTypeBadgeToneClass(type: number): string {
  switch (type) {
    case LOG_TYPE_ENUM.ERROR:
      return 'border border-rose-500/20 bg-rose-500/5 text-rose-400/90'
    case LOG_TYPE_ENUM.CONSUME:
      return 'border border-emerald-500/15 bg-emerald-500/5 text-slate-400'
    case LOG_TYPE_ENUM.MANAGE:
      return 'border border-amber-500/20 bg-amber-500/5 text-amber-400/80'
    case LOG_TYPE_ENUM.TOPUP:
      return 'border border-cyan-500/20 bg-cyan-500/5 text-cyan-400/80'
    case LOG_TYPE_ENUM.REFUND:
      return 'border border-sky-500/20 bg-sky-500/5 text-sky-400/80'
    case LOG_TYPE_ENUM.SYSTEM:
      return 'border border-violet-500/20 bg-violet-500/5 text-violet-400/80'
    default:
      return 'border border-[#DBEAFE] bg-[#F8FBFF] text-slate-500'
  }
}

function LogTypeBadge(props: {
  type: number
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  return (
    <span
      className={cn(
        usageLogsLogTypeBadgeBaseClassName,
        usageLogTypeBadgeToneClass(props.type)
      )}
    >
      {usageLogTypeLabel(props.type, props.t)}
    </span>
  )
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
    return [{ text: t('usageLogs.label.async_refund') }]
  }

  if (log.type !== 2) return []

  const isViolation = isViolationFeeLog(other)
  if (isViolation) {
    const segments: DetailSegment[] = []
    segments.push({ text: t('usageLogs.label.violation_fee'), danger: true })
    if (other?.violation_fee_code) {
      segments.push({
        text: other.violation_fee_code,
        muted: true,
      })
    }
    segments.push({
      text: `${t('usageLogs.label.quota_amount')}: ${formatUsageLogQuotaDisplay(other?.fee_quota ?? log.quota)}`,
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
        const tierLabel =
          tieredSummary.tier.label || t('usageLogs.dialog.matched_tier')
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
        text: `${t('usageLogs.dialog.dynamic_pricing')} · ${t('usageLogs.dialog.no_matching_tier')}`,
        muted: true,
      })
    }
  } else {
    const isPerCall = isPerCallBilling(other.model_price)
    if (isPerCall) {
      segments.push({
        text: `${t('usageLogs.dialog.per_call')} · ${formatBillingAmountForOpsCenter(other.model_price!, priceOpts)}`,
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
        text: `${t('usageLogs.dialog.standard')} · ${formatPriceList(baseEntries, true)}`,
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
        ? t('usageLogs.dialog.user_exclusive_ratio')
        : t('usageLogs.dialog.group_ratio')

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
        return (
          <div className='flex flex-col gap-px'>
            <span
              className={cn(
                'font-mono text-xs leading-tight tabular-nums',
                usageLogsTablePrimaryClass
              )}
            >
              {formatTimestampToDate(timestamp)}
            </span>
            <LogTypeBadge type={log.type} t={t} />
          </div>
        )
      },
      filterFn: (row, _id, value) => {
        if (!value || value.length === 0) return true
        return value.includes(String(row.original.type))
      },
      enableHiding: false,
      size: 132,
      minSize: 120,
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
                    <div className='flex max-w-[8.5rem] min-w-0 flex-col gap-px' />
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
                        {t('usageLogs.dialog.chain')}: {channelChain}
                      </p>
                    )}
                    {affinity && (
                      <div className='border-t pt-1 text-xs'>
                        <p className='font-medium'>
                          {t('usageLogs.dialog.channel_affinity')}
                        </p>
                        <p>
                          {t('usageLogs.dialog.rule')}: {affinity.rule_name || '-'}
                        </p>
                        <p>
                          {t('usageLogs.dialog.group')}:{' '}
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
        size: 120,
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
              className='flex min-w-0 items-center gap-1 text-left'
              aria-label={t('usageLogs.userDialog.view_account')}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedUserId(log.user_id)
                setUserInfoDialogOpen(true)
              }}
            >
              <Avatar className='size-5 shrink-0 ring-1 ring-white/15'>
                <AvatarFallback
                  className={cn(
                    'text-[11px] font-semibold',
                    !sensitiveVisible && usageLogsMaskedAvatarClassName
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
                          'min-w-0 max-w-[9.5rem] truncate text-sm font-medium hover:underline',
                          usageLogsTablePrimaryClass
                        )}
                      />
                    }
                  >
                    {sensitiveVisible ? log.username : '••••'}
                  </TooltipTrigger>
                  {sensitiveVisible && log.username.length > 14 && (
                    <TooltipContent side='top'>
                      {log.username}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </button>
          )
        },
        size: 168,
        minSize: 150,
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
        <div className='flex max-w-[11rem] min-w-0 flex-col gap-px'>
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
                    usageLogsInlinePillClass,
                    usageLogsTableBadgeMaxClassName
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
    size: 148,
    minSize: 120,
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
          <div className='flex max-w-[11rem] min-w-0 flex-col gap-px'>
            <ModelBadge
              modelName={modelInfo.name}
              actualModel={modelInfo.actualModel}
              className='border-[#DBEAFE] bg-[#F8FBFF] font-mono text-slate-800'
            />
          </div>
        )
      },
      size: 152,
      minSize: 120,
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
                {log.is_stream
                  ? t('usageLogs.stream.stream')
                  : t('usageLogs.stream.non_stream')}
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
                            {t('usageLogs.stream.status')}: {t('usageLogs.stream.error')}
                          </p>
                          <p>{other.stream_status.end_reason || 'unknown'}</p>
                          {(other.stream_status.error_count ?? 0) > 0 && (
                            <p>
                              {t('usageLogs.stream.soft_errors')}:{' '}
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
        if (!shouldShowQuotaColumn(log.type)) return null

        const quota = row.getValue('quota') as number
        const other = parseLogOther(log.other)
        const isSubscription = other?.billing_source === 'subscription'

        if (isSubscription) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className={usageLogsSubscriptionBadgeClassName} />
                  }
                >
                  <span
                    className='size-1.5 rounded-full bg-emerald-400'
                    aria-hidden='true'
                  />
                  {t('usageLogs.label.subscription')}
                </TooltipTrigger>
                <TooltipContent>
                  <span>
                    {t('usageLogs.label.deducted_by_subscription')}:{' '}
                    {formatUsageLogQuotaDisplay(quota)}
                  </span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        }

        const quotaStr = formatUsageLogQuotaDisplay(quota)

        return (
          <div className='flex flex-col gap-px'>
            <span
              className={cn(
                'w-fit max-w-full truncate font-semibold tabular-nums',
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
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('usageLogs.col.details')}
          className={usageLogsColumnHeaderClassName}
        />
      ),
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
              className='group flex min-w-0 max-w-full items-center gap-1 text-left'
              onClick={() => setDialogOpen(true)}
              title={t('usageLogs.action.view_details')}
            >
              {summaryText ? (
                <span
                  className={cn(
                    'block truncate text-sm leading-snug group-hover:underline',
                    primary?.danger
                      ? usageLogsTableFailReasonClass
                      : usageLogsDetailSummaryClass,
                    !primary?.danger && primary?.muted && 'text-slate-400'
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
                <span
                  className={cn(
                    'text-sm group-hover:underline',
                    usageLogsTableClickableLinkClass
                  )}
                >
                  {t('usageLogs.action.view')}
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
      enableHiding: false,
      meta: { label: t('usageLogs.col.details') },
      size: 168,
      minSize: 140,
      maxSize: 240,
    }
  )

  return columns
}
