import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Route, CircleAlert, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatBillingCurrencyFromUSD } from '@/lib/currency'
import {
  formatUseTime,
  formatLogQuota,
  formatTimestampToDate,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableColumnHeader } from '@/components/data-table'
import {
  StatusBadge,
  type StatusBadgeProps,
  dotColorMap,
  textColorMap,
} from '@/components/status-badge'
import type { UsageLog } from '../../data/schema'
import {
  getTimeColor,
  formatModelName,
  getTieredBillingSummary,
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
import { useUsageLogsContext } from '../usage-logs-provider'
import { CacheTooltip } from './column-helpers'

interface DetailSegment {
  text: string
  muted?: boolean
  danger?: boolean
}

function formatRatioCompact(ratio: number | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return '-'
  return ratio % 1 === 0 ? String(ratio) : ratio.toFixed(4)
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
      text: `${t('Fee')}: ${formatLogQuota(other?.fee_quota ?? log.quota)}`,
      muted: true,
    })
    return segments
  }

  if (!other) return []

  const segments: DetailSegment[] = []

  const userGroupRatio = other.user_group_ratio
  const groupRatio = other.group_ratio
  const isUserGroup =
    userGroupRatio != null &&
    Number.isFinite(userGroupRatio) &&
    userGroupRatio !== -1
  const effectiveRatio = isUserGroup ? userGroupRatio : groupRatio
  const ratioLabel = isUserGroup ? t('User Exclusive Ratio') : t('Group Ratio')

  if (effectiveRatio != null && Number.isFinite(effectiveRatio)) {
    segments.push({
      text: `${ratioLabel} ${formatRatioCompact(effectiveRatio)}x`,
    })
  }

  const priceOpts = { digitsLarge: 4, digitsSmall: 6, abbreviate: false }
  const tieredSummary = getTieredBillingSummary(other)
  if (tieredSummary) {
    if (tieredSummary.tier.label) {
      segments.push({
        text: `${t('Tier')} ${tieredSummary.tier.label}`,
        muted: true,
      })
    }
    for (const entry of tieredSummary.priceEntries) {
      segments.push({
        text: `${t(entry.shortLabel)} ${formatBillingCurrencyFromUSD(entry.price, priceOpts)}/M`,
        muted: true,
      })
    }
  } else {
    const isPerCall = isPerCallBilling(other.model_price)
    if (isPerCall) {
      segments.push({
        text: `${t('Model Price')} ${formatBillingCurrencyFromUSD(other.model_price!, priceOpts)}`,
        muted: true,
      })
    } else if (other.model_ratio != null) {
      const inputPriceUSD = other.model_ratio * 2.0
      segments.push({
        text: `${t('Input')} ${formatBillingCurrencyFromUSD(inputPriceUSD, priceOpts)}/M`,
        muted: true,
      })
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
        <DataTableColumnHeader column={column} title={t('Time')} />
      ),
      cell: ({ row }) => {
        const log = row.original
        const timestamp = row.getValue('created_at') as number
        const config = getLogTypeConfig(log.type)

        return (
          <div className='flex flex-col gap-0.5'>
            <span className='font-mono text-xs tabular-nums'>
              {formatTimestampToDate(timestamp)}
            </span>
            <StatusBadge
              label={t(config.label)}
              variant={config.color as StatusBadgeProps['variant']}
              size='sm'
              copyable={false}
            />
            {log.request_id && (
              <StatusBadge
                label={
                  log.request_id.length > 18
                    ? `${log.request_id.slice(0, 18)}…`
                    : log.request_id
                }
                variant='neutral'
                size='sm'
                copyText={log.request_id}
                className='max-w-[140px] truncate font-mono'
              />
            )}
          </div>
        )
      },
      filterFn: (row, _id, value) => {
        if (!value || value.length === 0) return true
        return value.includes(String(row.original.type))
      },
      enableHiding: false,
      meta: { label: t('Time') },
    },
  ]

  if (isAdmin) {
    columns.push({
      id: 'source',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Source')} />
      ),
      cell: function SourceCell({ row }) {
        const {
          setAffinityTarget,
          setAffinityDialogOpen,
          setSelectedUserId,
          setUserInfoDialogOpen,
        } = useUsageLogsContext()
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

        return (
          <div className='flex flex-col gap-1'>
            <div className='flex items-center gap-1'>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className='relative'>
                      <StatusBadge
                        label={channelDisplay}
                        autoColor={log.channel_name || String(log.channel)}
                        copyText={String(log.channel)}
                        size='sm'
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
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className='space-y-1'>
                      <p>{channelDisplay}</p>
                      {channelChain && (
                        <p className='text-muted-foreground text-xs'>
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
                            {affinity.using_group ||
                              affinity.selected_group ||
                              '-'}
                          </p>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {log.username && (
              <button
                type='button'
                className='flex items-center gap-1 text-left'
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedUserId(log.user_id)
                  setUserInfoDialogOpen(true)
                }}
              >
                <span className='bg-primary/10 text-primary flex size-4 items-center justify-center rounded-full text-[10px] font-bold'>
                  {log.username.charAt(0).toUpperCase()}
                </span>
                <span className='text-muted-foreground truncate text-xs hover:underline'>
                  {log.username}
                </span>
              </button>
            )}
          </div>
        )
      },
      meta: { label: t('Source'), mobileHidden: true },
    })
  }

  columns.push(
    {
      accessorKey: 'model_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Model')} />
      ),
      cell: function ModelCell({ row }) {
        const log = row.original
        if (!isDisplayableLogType(log.type)) return null

        const modelInfo = formatModelName(log)
        const tokenName = log.token_name
        const other = parseLogOther(log.other)
        let group = log.group
        if (!group) group = other?.group || ''

        const modelBadge = modelInfo.isMapped ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant='ghost'
                size='sm'
                className='h-auto p-0 hover:bg-transparent'
              >
                <span className='flex items-center gap-1'>
                  <StatusBadge
                    label={modelInfo.name}
                    autoColor={modelInfo.name}
                    copyText={modelInfo.name}
                    size='sm'
                    className='truncate font-mono'
                  />
                  <Route className='text-muted-foreground size-3 shrink-0' />
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-72'>
              <div className='space-y-2'>
                <div className='flex items-start justify-between gap-3'>
                  <span className='text-muted-foreground text-xs'>
                    {t('Request Model:')}
                  </span>
                  <span className='truncate font-mono text-xs font-medium'>
                    {modelInfo.name}
                  </span>
                </div>
                <div className='flex items-start justify-between gap-3'>
                  <span className='text-muted-foreground text-xs'>
                    {t('Actual Model:')}
                  </span>
                  <span className='truncate font-mono text-xs font-medium'>
                    {modelInfo.actualModel}
                  </span>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <StatusBadge
            label={modelInfo.name}
            autoColor={modelInfo.name}
            copyText={modelInfo.name}
            size='sm'
            className='truncate font-mono'
          />
        )

        const metaParts: string[] = []
        if (tokenName) metaParts.push(tokenName)
        if (group) metaParts.push(group)

        return (
          <div className='flex max-w-[220px] flex-col gap-0.5'>
            {modelBadge}
            {metaParts.length > 0 && (
              <span className='text-muted-foreground/60 truncate text-[11px]'>
                {metaParts.join(' · ')}
              </span>
            )}
          </div>
        )
      },
      meta: { label: t('Model'), mobileTitle: true },
    },

    {
      accessorKey: 'use_time',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Timing')} />
      ),
      cell: ({ row }) => {
        const log = row.original
        if (!isTimingLogType(log.type)) return null

        const useTime = row.getValue('use_time') as number
        const other = parseLogOther(log.other)
        const frt = other?.frt
        const timeVariant = getTimeColor(useTime)
        const frtVariant = frt ? getTimeColor(frt / 1000) : null

        return (
          <div className='flex flex-col gap-0.5'>
            <div className='flex items-center gap-1 text-xs'>
              <span
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  dotColorMap[timeVariant]
                )}
                aria-hidden='true'
              />
              <span
                className={cn(
                  'font-mono font-medium',
                  textColorMap[timeVariant]
                )}
              >
                {formatUseTime(useTime)}
              </span>
              {log.is_stream && frt != null && frt > 0 && (
                <>
                  <span className='text-muted-foreground/30'>·</span>
                  <span
                    className={cn(
                      'font-mono font-medium',
                      textColorMap[frtVariant!]
                    )}
                  >
                    {formatUseTime(frt / 1000)}
                  </span>
                </>
              )}
            </div>
            <div className='flex items-center gap-1 text-[11px]'>
              <span className='text-muted-foreground/60'>
                {log.is_stream ? t('Stream') : t('Non-stream')}
              </span>
              {log.is_stream &&
                other?.stream_status &&
                other.stream_status.status !== 'ok' && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <CircleAlert className='size-3 text-red-500' />
                      </TooltipTrigger>
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
      meta: { label: t('Timing'), mobileHidden: true },
    },

    {
      accessorKey: 'prompt_tokens',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Input')} />
      ),
      cell: ({ row }) => {
        const log = row.original
        if (!isDisplayableLogType(log.type)) return null

        const other = parseLogOther(log.other)
        if (isPerCallBilling(other?.model_price)) {
          return <span className='text-muted-foreground text-xs'>-</span>
        }

        const promptTokens = log.prompt_tokens || 0
        if (promptTokens === 0) {
          return <span className='text-muted-foreground text-xs'>-</span>
        }

        const cacheReadTokens = other?.cache_tokens || 0

        return (
          <div className='flex flex-col gap-0.5'>
            <span className='font-mono text-xs font-medium'>
              {promptTokens.toLocaleString()}
            </span>
            {cacheReadTokens > 0 && (
              <span className='flex items-center gap-1 text-[11px]'>
                <CacheTooltip
                  tokens={cacheReadTokens}
                  label={t('Cache Read')}
                  color='fill-amber-500 text-amber-500'
                />
                <span className='text-muted-foreground/60'>
                  {t('Cache Read')} {cacheReadTokens.toLocaleString()}
                </span>
              </span>
            )}
          </div>
        )
      },
      meta: { label: t('Input'), mobileHidden: true },
    },

    {
      accessorKey: 'completion_tokens',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Output')} />
      ),
      cell: ({ row }) => {
        const log = row.original
        if (!isDisplayableLogType(log.type)) return null

        const other = parseLogOther(log.other)
        if (isPerCallBilling(other?.model_price)) {
          return <span className='text-muted-foreground text-xs'>-</span>
        }

        const completionTokens = log.completion_tokens || 0
        if (completionTokens === 0) {
          return <span className='text-muted-foreground text-xs'>-</span>
        }

        const cacheWrite5m = other?.cache_creation_tokens_5m || 0
        const cacheWrite1h = other?.cache_creation_tokens_1h || 0
        const hasSplitCache = cacheWrite5m > 0 || cacheWrite1h > 0
        const cacheWriteTokens = hasSplitCache
          ? cacheWrite5m + cacheWrite1h
          : other?.cache_creation_tokens || 0

        return (
          <div className='flex flex-col gap-0.5'>
            <span className='font-mono text-xs font-medium'>
              {completionTokens.toLocaleString()}
            </span>
            {cacheWriteTokens > 0 && (
              <span className='flex items-center gap-1 text-[11px]'>
                <CacheTooltip
                  tokens={cacheWriteTokens}
                  label={t('Cache Write')}
                  color='fill-blue-500 text-blue-500'
                />
                <span className='text-muted-foreground/60'>
                  {hasSplitCache
                    ? `${t('Cache Write')} ${cacheWrite5m.toLocaleString()}/${cacheWrite1h.toLocaleString()}`
                    : `${t('Cache Write')} ${cacheWriteTokens.toLocaleString()}`}
                </span>
              </span>
            )}
          </div>
        )
      },
      meta: { label: t('Output'), mobileHidden: true },
    },

    {
      accessorKey: 'quota',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Cost')} />
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
                <TooltipTrigger asChild>
                  <div>
                    <StatusBadge
                      label={t('Subscription')}
                      variant='green'
                      size='sm'
                      copyable={false}
                    />
                  </div>
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
          <div className='flex flex-col'>
            <span className='font-mono text-xs font-medium tabular-nums'>
              {formatLogQuota(quota)}
            </span>
            {(() => {
              const userGroupRatio = other?.user_group_ratio
              if (
                userGroupRatio != null &&
                userGroupRatio !== -1 &&
                Number.isFinite(userGroupRatio)
              ) {
                return (
                  <span className='text-muted-foreground/60 text-[11px]'>
                    {t('User Group: {{ratio}}x', { ratio: userGroupRatio })}
                  </span>
                )
              }
              const groupRatio = other?.group_ratio
              if (groupRatio != null && groupRatio !== 1) {
                return (
                  <span className='text-muted-foreground/60 text-[11px]'>
                    {t('Group: {{ratio}}x', { ratio: groupRatio })}
                  </span>
                )
              }
              return null
            })()}
          </div>
        )
      },
      meta: { label: t('Cost') },
    },

    {
      accessorKey: 'content',
      header: t('Details'),
      cell: function DetailsCell({ row }) {
        const [dialogOpen, setDialogOpen] = useState(false)
        const log = row.original
        const other = parseLogOther(log.other)

        const segments = buildDetailSegments(log, other, t)

        return (
          <>
            <Button
              variant='ghost'
              className='h-auto max-w-[220px] justify-start p-0 text-left text-xs font-normal hover:underline'
              onClick={() => setDialogOpen(true)}
              title={t('Click to view full details')}
            >
              {segments.length > 0 ? (
                <div className='flex flex-col gap-px'>
                  {segments.map((seg, i) => (
                    <span
                      key={i}
                      className={cn(
                        'leading-snug',
                        seg.muted
                          ? 'text-muted-foreground/60'
                          : seg.danger
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-foreground'
                      )}
                    >
                      {seg.text}
                    </span>
                  ))}
                </div>
              ) : log.content ? (
                <span className='line-clamp-2'>{log.content}</span>
              ) : (
                <span className='text-muted-foreground'>-</span>
              )}
            </Button>
            <DetailsDialog
              log={log}
              isAdmin={isAdmin}
              open={dialogOpen}
              onOpenChange={setDialogOpen}
            />
          </>
        )
      },
      meta: { label: t('Details'), mobileHidden: true },
      size: 200,
      maxSize: 220,
    }
  )

  return columns
}
