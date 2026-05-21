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
  Copy,
  Check,
  Route,
  Settings2,
  AlertTriangle,
  Headphones,
  Monitor,
  Cloud,
  Globe,
  ShieldCheck,
  UserCog,
  Info,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  formatBillingAmountForOpsCenter,
  formatUsageLogQuotaDisplay,
} from '@/lib/ops-billing-display'
import { formatTokens, formatUseTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { StatusBadge, type StatusBadgeProps } from '@/components/status-badge'
import { DynamicPricingBreakdown } from '@/features/pricing/components/dynamic-pricing-breakdown'
import type { UsageLog } from '../../data/schema'
import {
  parseLogOther,
  getParamOverrideActionLabel,
  parseAuditLine,
  decodeBillingExprB64,
  getTieredBillingSummary,
  hasAnyCacheTokens,
  isViolationFeeLog,
  getFirstResponseTimeColor,
  getResponseTimeColor,
  formatLogContentSummaryForDisplay,
} from '../../lib/format'
import {
  usageLogsDialogBackendPreClassName,
  usageLogsDialogBackendTextClassName,
  usageLogsDialogContentPanelClassName,
  usageLogsDialogContentTextClassName,
  usageLogsDialogCopyButtonClassName,
  usageLogsDialogCopyButtonInlineClassName,
  usageLogsDialogLabelClassName,
  usageLogsDialogMutedInlineClassName,
  usageLogsDialogParamOverrideContentClassName,
  usageLogsDialogParamOverrideRowClassName,
  usageLogsDialogSectionDangerClassName,
  usageLogsDialogSectionDangerLabelClassName,
  usageLogsDialogSectionLabelClassName,
  usageLogsDialogSectionPanelClassName,
  usageLogsDialogTieredPanelClassName,
  usageLogsDialogTimingDangerClassName,
  usageLogsDialogTimingSuccessClassName,
  usageLogsDialogTimingWarningClassName,
  usageLogsDialogTitleClassName,
  usageLogsDialogValueClassName,
  usageLogsDialogValueMutedClassName,
  usageLogsDialogWarningTextClassName,
} from '../../lib/ops-ui-styles'
import { LOG_TYPE_ENUM } from '../../constants'
import {
  getLogTypeConfig,
  isPerCallBilling,
  isTimingLogType,
} from '../../lib/utils'
import type { LogOtherData } from '../../types'

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

function timingTextColorClass(
  variant: 'success' | 'warning' | 'danger'
): string {
  if (variant === 'success') return usageLogsDialogTimingSuccessClassName
  if (variant === 'warning') return usageLogsDialogTimingWarningClassName
  return usageLogsDialogTimingDangerClassName
}

function DetailRow(props: {
  label: React.ReactNode
  value: React.ReactNode
  mono?: boolean
  muted?: boolean
}) {
  return (
    <div className='grid min-w-0 grid-cols-[5.25rem_minmax(0,1fr)] gap-2 text-sm sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3'>
      <span className={usageLogsDialogLabelClassName}>{props.label}</span>
      <span
        className={cn(
          props.muted
            ? usageLogsDialogValueMutedClassName
            : usageLogsDialogValueClassName,
          props.mono && 'font-mono'
        )}
      >
        {props.value}
      </span>
    </div>
  )
}

function DetailSection(props: {
  icon?: React.ReactNode
  label: string
  variant?: 'default' | 'danger'
  children: React.ReactNode
}) {
  const isDanger = props.variant === 'danger'
  return (
    <div className='min-w-0 space-y-1.5'>
      <Label
        className={cn(
          isDanger
            ? usageLogsDialogSectionDangerLabelClassName
            : usageLogsDialogSectionLabelClassName
        )}
      >
        {props.icon}
        {props.label}
      </Label>
      <div
        className={
          isDanger
            ? usageLogsDialogSectionDangerClassName
            : usageLogsDialogSectionPanelClassName
        }
      >
        {props.children}
      </div>
    </div>
  )
}

function formatRatio(ratio: number | undefined): string {
  if (ratio == null) return '-'
  return ratio.toFixed(4)
}

function BillingBreakdown(props: {
  log: UsageLog
  other: LogOtherData
  isAdmin: boolean
}) {
  const { t } = useTranslation()
  const { log, other, isAdmin } = props
  const isPerCall = isPerCallBilling(other.model_price)
  const isClaude = other.claude === true
  const isTieredExpr = other.billing_mode === 'tiered_expr'
  const tieredSummary = getTieredBillingSummary(other)

  const rows: Array<{ label: string; value: string }> = []
  const priceOpts = { digitsLarge: 4, digitsSmall: 6, abbreviate: false }
  const fmtPrice = (usd: number) =>
    formatBillingAmountForOpsCenter(usd, priceOpts)
  const baseInputUSD = other.model_ratio != null ? other.model_ratio * 2.0 : 0

  if (isTieredExpr) {
    rows.push({
      label: t('usageLogs.dialog.billing_mode'),
      value: t('usageLogs.dialog.dynamic_pricing'),
    })
    if (tieredSummary) {
      if (tieredSummary.tier.label) {
        rows.push({
          label: t('usageLogs.dialog.matched_tier'),
          value: tieredSummary.tier.label,
        })
      }
      for (const entry of tieredSummary.priceEntries) {
        rows.push({
          label: t(entry.shortLabel),
          value: `${fmtPrice(entry.price)}/M`,
        })
      }
    } else {
      rows.push({
        label: t('usageLogs.dialog.matched_tier'),
        value: t('usageLogs.dialog.no_matching_tier'),
      })
    }
  } else if (isPerCall) {
    rows.push({
      label: t('usageLogs.dialog.billing_mode'),
      value: t('usageLogs.dialog.per_call'),
    })
    if (other.model_price != null) {
      rows.push({
        label: t('usageLogs.dialog.model_unit_price'),
        value: fmtPrice(other.model_price),
      })
    }
  } else {
    rows.push({
      label: t('usageLogs.dialog.billing_mode'),
      value: t('usageLogs.dialog.per_token'),
    })
    if (other.model_ratio != null) {
      rows.push({
        label: t('usageLogs.dialog.input_unit_price'),
        value: `${fmtPrice(baseInputUSD)}/M`,
      })
    }
    if (other.completion_ratio != null && other.model_ratio != null) {
      rows.push({
        label: t('usageLogs.dialog.output_unit_price'),
        value: `${fmtPrice(baseInputUSD * other.completion_ratio)}/M`,
      })
    }
  }

  const userGR = other.user_group_ratio
  const isUserGR = userGR != null && Number.isFinite(userGR) && userGR !== -1
  const effectiveGR = isUserGR ? userGR : other.group_ratio
  if (effectiveGR != null && Number.isFinite(effectiveGR)) {
    rows.push({
      label: isUserGR
        ? t('usageLogs.dialog.user_exclusive_ratio')
        : t('usageLogs.dialog.group_ratio'),
      value: `${formatRatio(effectiveGR)}x`,
    })
  }

  if (!isTieredExpr && isClaude && hasAnyCacheTokens(other)) {
    if (other.cache_ratio != null && other.cache_ratio !== 1) {
      rows.push({
        label: t('usageLogs.dialog.cache_read_unit_price'),
        value: `${fmtPrice(baseInputUSD * other.cache_ratio)}/M`,
      })
    }
    if (
      other.cache_creation_ratio != null &&
      other.cache_creation_ratio !== 1
    ) {
      rows.push({
        label: t('usageLogs.dialog.cache_creation_unit_price'),
        value: `${fmtPrice(baseInputUSD * other.cache_creation_ratio)}/M`,
      })
    }
    if (
      other.cache_creation_ratio_5m != null &&
      other.cache_creation_ratio_5m !== 0
    ) {
      rows.push({
        label: t('usageLogs.dialog.cache_creation_5m_unit_price'),
        value: `${fmtPrice(baseInputUSD * other.cache_creation_ratio_5m)}/M`,
      })
    }
    if (
      other.cache_creation_ratio_1h != null &&
      other.cache_creation_ratio_1h !== 0
    ) {
      rows.push({
        label: t('usageLogs.dialog.cache_creation_1h_unit_price'),
        value: `${fmtPrice(baseInputUSD * other.cache_creation_ratio_1h)}/M`,
      })
    }
  }

  if (!isTieredExpr) {
    if (other.audio_ratio != null && other.audio_ratio !== 1) {
      rows.push({
        label: t('usageLogs.dialog.audio_input_per_m'),
        value: `${fmtPrice(baseInputUSD * other.audio_ratio)}/M`,
      })
    }

    if (
      other.audio_completion_ratio != null &&
      other.audio_completion_ratio !== 1
    ) {
      rows.push({
        label: t('usageLogs.dialog.audio_output_per_m'),
        value: `${fmtPrice(baseInputUSD * other.audio_completion_ratio)}/M`,
      })
    }

    if (other.image_ratio != null && other.image_ratio !== 1) {
      rows.push({
        label: t('usageLogs.dialog.image_input_per_m'),
        value: `${fmtPrice(baseInputUSD * other.image_ratio)}/M`,
      })
    }
  }

  if (other.web_search && other.web_search_call_count) {
    rows.push({
      label: t('usageLogs.dialog.web_search'),
      value: `${other.web_search_call_count}x${other.web_search_price ? ` (${fmtPrice(other.web_search_price)})` : ''}`,
    })
  }

  if (other.file_search && other.file_search_call_count) {
    rows.push({
      label: t('usageLogs.dialog.file_search'),
      value: `${other.file_search_call_count}x${other.file_search_price ? ` (${fmtPrice(other.file_search_price)})` : ''}`,
    })
  }

  if (other.image_generation_call && other.image_generation_call_price) {
    rows.push({
      label: t('usageLogs.dialog.image_generation_unit_price'),
      value: fmtPrice(other.image_generation_call_price),
    })
  }

  if (other.audio_input_seperate_price && other.audio_input_price) {
    rows.push({
      label: t('usageLogs.dialog.audio_input_unit_price'),
      value: fmtPrice(other.audio_input_price),
    })
  }

  if (isAdmin && other.admin_info) {
    rows.push({
      label: t('usageLogs.dialog.billing_source'),
      value: other.admin_info.local_count_tokens
        ? t('usageLogs.dialog.local_billing')
        : t('usageLogs.dialog.upstream_response'),
    })
  }

  rows.push({
    label: t('usageLogs.dialog.quota_consumption'),
    value: formatUsageLogQuotaDisplay(log.quota),
  })

  if (rows.length === 0) return null

  return (
    <DetailSection label={t('usageLogs.dialog.billing_details')}>
      {rows.map((row, idx) => (
        <DetailRow key={idx} label={row.label} value={row.value} mono />
      ))}
    </DetailSection>
  )
}

function TokenBreakdown(props: { log: UsageLog; other: LogOtherData }) {
  const { t } = useTranslation()
  const { log, other } = props

  const promptTokens = log.prompt_tokens || 0
  const completionTokens = log.completion_tokens || 0
  const cacheRead = other.cache_tokens || 0
  const cacheWrite = other.cache_creation_tokens || 0
  const cacheWrite5m = other.cache_creation_tokens_5m || 0
  const cacheWrite1h = other.cache_creation_tokens_1h || 0
  const hasTokens = promptTokens > 0 || completionTokens > 0

  if (!hasTokens) return null

  const rows: Array<{ label: string; value: string }> = []

  rows.push({
    label: t('usageLogs.dialog.input_tokens'),
    value: promptTokens.toLocaleString(),
  })
  rows.push({
    label: t('usageLogs.dialog.output_tokens'),
    value: completionTokens.toLocaleString(),
  })

  if (cacheRead > 0) {
    rows.push({
      label: t('usageLogs.dialog.cache_read_tokens'),
      value: cacheRead.toLocaleString(),
    })
  }

  if (cacheWrite > 0 && cacheWrite5m === 0 && cacheWrite1h === 0) {
    rows.push({
      label: t('usageLogs.dialog.cache_write_tokens'),
      value: cacheWrite.toLocaleString(),
    })
  }

  if (cacheWrite5m > 0) {
    rows.push({
      label: t('usageLogs.dialog.cache_write_5m_tokens'),
      value: cacheWrite5m.toLocaleString(),
    })
  }

  if (cacheWrite1h > 0) {
    rows.push({
      label: t('usageLogs.dialog.cache_write_1h_tokens'),
      value: cacheWrite1h.toLocaleString(),
    })
  }

  if (other.image && other.image_output) {
    rows.push({
      label: t('usageLogs.dialog.image_output_tokens'),
      value: other.image_output.toLocaleString(),
    })
  }

  return (
    <DetailSection label={t('usageLogs.dialog.token_breakdown')}>
      {rows.map((row, idx) => (
        <DetailRow key={idx} label={row.label} value={row.value} mono />
      ))}
    </DetailSection>
  )
}

interface DetailsDialogProps {
  log: UsageLog
  isAdmin: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DetailsDialog(props: DetailsDialogProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })
  const rawDetails = props.log.content ?? ''
  const displayDetails = formatLogContentSummaryForDisplay(
    rawDetails,
    props.log.type
  )
  const other = parseLogOther(props.log.other)
  const typeConfig = getLogTypeConfig(props.log.type)

  const isViolation = isViolationFeeLog(other)
  const isRefund = props.log.type === 6
  const isConsume = props.log.type === 2
  const isTopup = props.log.type === 1
  const isManage = props.log.type === 3
  const isSubscription = other?.billing_source === 'subscription'
  const isTieredBilling =
    isConsume &&
    !isViolation &&
    other?.billing_mode === 'tiered_expr' &&
    !!other?.expr_b64
  const hasAudioTokens = other?.ws || other?.audio
  const showTiming = isTimingLogType(props.log.type)
  const showAdminIp =
    !!props.log.ip && (showTiming || (props.isAdmin && isTopup))
  const adminInfo = other?.admin_info
  const topupAuditFields =
    isTopup && props.isAdmin && adminInfo
      ? ([
          adminInfo.payment_method && {
            label: t('Order Payment Method'),
            value: adminInfo.payment_method,
          },
          adminInfo.callback_payment_method && {
            label: t('Callback Payment Method'),
            value: adminInfo.callback_payment_method,
          },
          adminInfo.caller_ip && {
            label: t('Callback Caller IP'),
            value: adminInfo.caller_ip,
          },
          adminInfo.server_ip && {
            label: t('Server IP'),
            value: adminInfo.server_ip,
          },
          adminInfo.node_name && {
            label: t('Node Name'),
            value: adminInfo.node_name,
          },
          adminInfo.version && {
            label: t('System Version'),
            value: adminInfo.version,
          },
        ].filter(Boolean) as Array<{ label: string; value: string }>)
      : []
  const showLegacyTopupWarning = isTopup && props.isAdmin && !adminInfo
  const showTopupAuditSection =
    isTopup &&
    props.isAdmin &&
    (topupAuditFields.length > 0 || showLegacyTopupWarning)
  const manageOperator = (() => {
    if (!isManage || !props.isAdmin || !adminInfo) return null
    const username = adminInfo.admin_username
    const id = adminInfo.admin_id
    const hasUsername = username != null && String(username).trim() !== ''
    const hasId = id != null && String(id).trim() !== ''
    if (!hasUsername && !hasId) return null
    if (hasUsername && hasId) {
      return t('usageLogs.dialog.operator_display', {
        name: username,
        id: String(id),
      })
    }
    if (hasUsername) return String(username)
    return t('usageLogs.dialog.operator_id', { id: String(id) })
  })()

  const conversionChain =
    other && Array.isArray(other.request_conversion)
      ? other.request_conversion.filter(Boolean)
      : []
  const conversionLabel =
    conversionChain.length <= 1
      ? t('usageLogs.dialog.native_format')
      : conversionChain.join(' → ')
  const showConversion =
    props.isAdmin &&
    props.log.type !== 6 &&
    (other?.request_path || conversionChain.length > 0)

  const useChannel = other?.admin_info?.use_channel
  const channelChain =
    useChannel && useChannel.length > 0 ? useChannel.join(' → ') : undefined

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        className={cn(
          'min-w-0 overflow-hidden',
          'max-sm:max-h-[calc(100dvh-1.5rem)] max-sm:w-[calc(100vw-1.5rem)] max-sm:max-w-[calc(100vw-1.5rem)] max-sm:p-4',
          isTieredBilling ? 'sm:max-w-4xl lg:max-w-5xl' : 'sm:max-w-lg'
        )}
      >
        <DialogHeader className='max-sm:gap-1'>
          <DialogTitle
            className={cn(
              'flex items-center gap-2',
              usageLogsDialogTitleClassName
            )}
          >
            {t('usageLogs.dialog.title')}
            <StatusBadge
              label={usageLogTypeLabel(props.log.type, t)}
              variant={typeConfig.color as StatusBadgeProps['variant']}
              size='sm'
              copyable={false}
            />
          </DialogTitle>
          <DialogDescription className='sr-only'>
            {t('usageLogs.dialog.sr_description')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className='max-h-[70vh] min-w-0 overflow-hidden pr-2 max-sm:max-h-[calc(100dvh-7rem)] sm:pr-4'>
          <div className='w-full max-w-full min-w-0 space-y-2.5 overflow-hidden py-1 sm:space-y-3'>
            {/* Overview section - key identifiers */}
            <div className='min-w-0 space-y-1'>
              {props.log.request_id && (
                <DetailRow
                  label={t('usageLogs.dialog.request_id')}
                  value={props.log.request_id}
                  mono
                />
              )}
              {props.log.upstream_request_id && (
                <DetailRow
                  label={t('usageLogs.dialog.upstream_request_id')}
                  value={props.log.upstream_request_id}
                  mono
                />
              )}

              {props.isAdmin && props.log.channel > 0 && (
                <DetailRow
                  label={t('usageLogs.dialog.channel')}
                  value={
                    <span>
                      {props.log.channel}
                      {props.log.channel_name && (
                        <span className={usageLogsDialogMutedInlineClassName}>
                          {' '}
                          ({props.log.channel_name})
                        </span>
                      )}
                    </span>
                  }
                  mono
                />
              )}

              {channelChain && props.isAdmin && (
                <DetailRow
                  label={t('usageLogs.dialog.retry_chain')}
                  value={channelChain}
                  mono
                />
              )}

              {props.log.token_name && (
                <DetailRow
                  label={t('usageLogs.dialog.access_key')}
                  value={props.log.token_name}
                  mono
                />
              )}

              {(props.log.group || other?.group) && (
                <DetailRow
                  label={t('usageLogs.dialog.group')}
                  value={props.log.group || other?.group || ''}
                  mono
                />
              )}

              {showAdminIp && (
                <DetailRow
                  label={t('usageLogs.dialog.ip_address')}
                  value={
                    <span className='flex items-center gap-1'>
                      <Globe
                        className='size-3 text-amber-500'
                        aria-hidden='true'
                      />
                      {props.log.ip}
                    </span>
                  }
                  mono
                />
              )}

              {showTiming && props.log.use_time > 0 && (
                <DetailRow
                  label={t('usageLogs.dialog.response_time')}
                  value={
                    <span
                      className={cn(
                        'font-medium',
                        timingTextColorClass(
                          getResponseTimeColor(
                            props.log.use_time,
                            props.log.completion_tokens
                          )
                        )
                      )}
                    >
                      {formatUseTime(props.log.use_time)}
                      {props.log.is_stream &&
                        other?.frt != null &&
                        other.frt > 0 && (
                          <span
                            className={cn(
                              'font-normal',
                              timingTextColorClass(
                                getFirstResponseTimeColor(other.frt / 1000)
                              )
                            )}
                          >
                            {' '}
                            ({t('usageLogs.dialog.frt')}：{' '}
                            {formatUseTime(other.frt / 1000)})
                          </span>
                        )}
                    </span>
                  }
                />
              )}
            </div>

            {/* Request conversion (admin only, not for refund) */}
            {showConversion && (
              <DetailSection label={t('usageLogs.dialog.request_conversion')}>
                <div className='relative min-w-0'>
                  <Button
                    variant='ghost'
                    size='sm'
                    className={usageLogsDialogCopyButtonInlineClassName}
                    onClick={() => copyToClipboard(conversionLabel)}
                    title={t('usageLogs.action.copy')}
                    aria-label={t('usageLogs.action.copy')}
                  >
                    {copiedText === conversionLabel ? (
                      <Check className='size-3.5 text-emerald-700' />
                    ) : (
                      <Copy className='size-3.5' />
                    )}
                  </Button>
                  <div className='min-w-0 space-y-1 pr-7'>
                    {other?.request_path && (
                      <DetailRow
                        label={t('usageLogs.dialog.path')}
                        value={other.request_path}
                        mono
                      />
                    )}
                    <div className='flex min-w-0 items-center gap-1.5 text-xs'>
                      <Route
                        className={cn('size-3', usageLogsDialogMutedInlineClassName)}
                        aria-hidden='true'
                      />
                      <span
                        className={cn(
                          'min-w-0 break-all sm:break-words',
                          usageLogsDialogValueClassName
                        )}
                      >
                        {conversionLabel}
                      </span>
                    </div>
                  </div>
                </div>
              </DetailSection>
            )}

            {/* Reject reason (admin only) */}
            {props.isAdmin && other?.reject_reason && (
              <DetailSection
                icon={<AlertTriangle className='size-3.5' aria-hidden='true' />}
                label={t('usageLogs.dialog.reject_reason')}
                variant='danger'
              >
                <p className={usageLogsDialogBackendTextClassName}>
                  {other.reject_reason}
                </p>
              </DetailSection>
            )}

            {/* Violation fee info */}
            {isViolation && other && (
              <DetailSection
                icon={<AlertTriangle className='size-3.5' aria-hidden='true' />}
                label={t('usageLogs.label.violation_fee')}
                variant='danger'
              >
                {other.violation_fee_code && (
                  <DetailRow
                    label={t('usageLogs.dialog.violation_code')}
                    value={other.violation_fee_code}
                    mono
                  />
                )}
                {other.violation_fee_marker && (
                  <DetailRow
                    label={t('usageLogs.dialog.violation_marker')}
                    value={other.violation_fee_marker}
                  />
                )}
                <DetailRow
                  label={t('usageLogs.dialog.violation_quota')}
                  value={formatUsageLogQuotaDisplay(
                    other.fee_quota ?? props.log.quota
                  )}
                  mono
                />
              </DetailSection>
            )}

            {/* Refund details (type=6) */}
            {isRefund && other && (other.task_id || other.reason) && (
              <DetailSection label={t('usageLogs.dialog.refund_details')}>
                {other.task_id && (
                  <DetailRow
                    label={t('usageLogs.dialog.task_id')}
                    value={other.task_id}
                    mono
                  />
                )}
                {other.reason && (
                  <DetailRow
                    label={t('usageLogs.dialog.reason')}
                    value={other.reason}
                  />
                )}
              </DetailSection>
            )}

            {/* Top-up audit info (type=1, admin only) */}
            {showTopupAuditSection && (
              <DetailSection
                icon={<ShieldCheck className='size-3.5' aria-hidden='true' />}
                label={t('usageLogs.dialog.topup_audit')}
              >
                {topupAuditFields.map((field, idx) => (
                  <DetailRow
                    key={idx}
                    label={field.label}
                    value={field.value}
                    mono
                  />
                ))}
                {showLegacyTopupWarning && (
                  <div
                    className={cn(
                      'flex items-start gap-1.5',
                      usageLogsDialogWarningTextClassName
                    )}
                  >
                    <Info
                      className='mt-0.5 size-3.5 shrink-0'
                      aria-hidden='true'
                    />
                    <span>
                      {t(
                        'This record was written by a pre-upgrade instance and lacks audit info. Upgrade the instance to record server IP, callback IP, payment method and system version.'
                      )}
                    </span>
                  </div>
                )}
              </DetailSection>
            )}

            {/* Manage operator (type=3, admin only) */}
            {manageOperator && (
              <DetailRow
                label={
                  <span className='flex items-center gap-1.5'>
                    <UserCog
                      className={cn('size-3.5', usageLogsDialogMutedInlineClassName)}
                      aria-hidden='true'
                    />
                    {t('usageLogs.dialog.operator_admin')}
                  </span>
                }
                value={manageOperator}
                mono
              />
            )}

            {/* Audio/WebSocket token breakdown */}
            {hasAudioTokens && other && (
              <DetailSection
                icon={<Headphones className='size-3.5' aria-hidden='true' />}
                label={t('usageLogs.dialog.audio_section')}
              >
                {other.audio_input != null && other.audio_input > 0 && (
                  <DetailRow
                    label={t('usageLogs.dialog.audio_input')}
                    value={formatTokens(other.audio_input)}
                    mono
                  />
                )}
                {other.audio_output != null && other.audio_output > 0 && (
                  <DetailRow
                    label={t('usageLogs.dialog.audio_output')}
                    value={formatTokens(other.audio_output)}
                    mono
                  />
                )}
                {other.text_input != null && other.text_input > 0 && (
                  <DetailRow
                    label={t('usageLogs.dialog.text_input')}
                    value={formatTokens(other.text_input)}
                    mono
                  />
                )}
                {other.text_output != null && other.text_output > 0 && (
                  <DetailRow
                    label={t('usageLogs.dialog.text_output')}
                    value={formatTokens(other.text_output)}
                    mono
                  />
                )}
              </DetailSection>
            )}

            {/* Reasoning effort */}
            {other?.reasoning_effort && (
              <DetailRow
                label={t('Reasoning Effort')}
                value={
                  <StatusBadge
                    label={other.reasoning_effort}
                    variant={
                      other.reasoning_effort === 'high'
                        ? 'orange'
                        : other.reasoning_effort === 'medium'
                          ? 'yellow'
                          : 'green'
                    }
                    size='sm'
                    copyable={false}
                  />
                }
              />
            )}

            {/* System prompt override */}
            {other?.is_system_prompt_overwritten && (
              <DetailRow
                label={t('System Prompt')}
                value={
                  <StatusBadge
                    label={t('Overwritten')}
                    variant='orange'
                    size='sm'
                    copyable={false}
                  />
                }
              />
            )}

            {/* Model mapping */}
            {other?.is_model_mapped && other?.upstream_model_name && (
              <DetailSection label={t('usageLogs.dialog.model_mapping')}>
                <DetailRow
                  label={t('usageLogs.dialog.request_model')}
                  value={props.log.model_name}
                  mono
                />
                <DetailRow
                  label={t('usageLogs.dialog.actual_model')}
                  value={other.upstream_model_name}
                  mono
                />
              </DetailSection>
            )}

            {/* Token breakdown (for consume/error types with token data) */}
            {isDisplayableType(props.log.type) && other && (
              <TokenBreakdown log={props.log} other={other} />
            )}

            {/* Billing breakdown (consume type) */}
            {isConsume && other && !isViolation && (
              <BillingBreakdown
                log={props.log}
                other={other}
                isAdmin={props.isAdmin}
              />
            )}

            {/* Tiered pricing breakdown (when billing_mode is tiered_expr) */}
            {isTieredBilling && other?.expr_b64 && (
              <div className={usageLogsDialogTieredPanelClassName}>
                <DynamicPricingBreakdown
                  billingExpr={decodeBillingExprB64(other.expr_b64)}
                  matchedTierLabel={other.matched_tier}
                  hideCacheColumns={!hasAnyCacheTokens(other)}
                />
              </div>
            )}

            {/* Admin billing mode indicator for non-consume */}
            {props.isAdmin &&
              !isConsume &&
              props.log.type !== 6 &&
              other?.admin_info && (
                <DetailRow
                  label={t('usageLogs.dialog.billing_source')}
                  value={
                    <span className='flex items-center gap-1'>
                      {other.admin_info.local_count_tokens ? (
                        <Monitor className='size-3 text-blue-500' />
                      ) : (
                        <Cloud className='size-3 text-emerald-500' />
                      )}
                      <span className={usageLogsDialogValueClassName}>
                        {other.admin_info.local_count_tokens
                          ? t('usageLogs.dialog.local_billing')
                          : t('usageLogs.dialog.upstream_response')}
                      </span>
                    </span>
                  }
                />
              )}

            {/* Stream status details (admin only) */}
            {props.isAdmin &&
              other?.stream_status &&
              other.stream_status.status !== 'ok' && (
                <DetailSection label={t('usageLogs.stream.status')}>
                  <DetailRow
                    label={t('usageLogs.dialog.status')}
                    value={
                      <StatusBadge
                        label={
                          other.stream_status.status || t('usageLogs.stream.error')
                        }
                        variant='red'
                        size='sm'
                        copyable={false}
                      />
                    }
                  />
                  {other.stream_status.end_reason && (
                    <DetailRow
                      label={t('usageLogs.stream.end_reason')}
                      value={other.stream_status.end_reason}
                    />
                  )}
                  {(other.stream_status.error_count ?? 0) > 0 && (
                    <DetailRow
                      label={t('usageLogs.stream.soft_errors')}
                      value={String(other.stream_status.error_count)}
                    />
                  )}
                  {other.stream_status.end_error && (
                    <DetailRow
                      label={t('usageLogs.stream.end_error')}
                      value={other.stream_status.end_error}
                    />
                  )}
                  {Array.isArray(other.stream_status.errors) &&
                    other.stream_status.errors.length > 0 && (
                      <pre className={usageLogsDialogBackendPreClassName}>
                        {other.stream_status.errors.join('\n')}
                      </pre>
                    )}
                </DetailSection>
              )}

            {/* Subscription billing details */}
            {isSubscription && other && (
              <DetailSection label={t('usageLogs.dialog.subscription_billing')}>
                {other.subscription_plan_id && (
                  <DetailRow
                    label={t('usageLogs.dialog.plan')}
                    value={`#${other.subscription_plan_id} ${other.subscription_plan_title || ''}`.trim()}
                  />
                )}
                {other.subscription_id && (
                  <DetailRow
                    label={t('usageLogs.dialog.instance')}
                    value={`#${other.subscription_id}`}
                    mono
                  />
                )}
                {other.subscription_pre_consumed != null && (
                  <DetailRow
                    label={t('usageLogs.dialog.pre_consumed')}
                    value={formatUsageLogQuotaDisplay(
                      other.subscription_pre_consumed
                    )}
                    mono
                  />
                )}
                {other.subscription_post_delta != null &&
                  other.subscription_post_delta !== 0 && (
                    <DetailRow
                      label={t('usageLogs.dialog.post_delta')}
                      value={formatUsageLogQuotaDisplay(
                        other.subscription_post_delta
                      )}
                      mono
                    />
                  )}
                {other.subscription_consumed != null && (
                  <DetailRow
                    label={t('usageLogs.dialog.final_consumed')}
                    value={formatUsageLogQuotaDisplay(
                      other.subscription_consumed
                    )}
                    mono
                  />
                )}
                {other.subscription_remain != null && (
                  <DetailRow
                    label={t('usageLogs.dialog.remaining')}
                    value={`${formatUsageLogQuotaDisplay(other.subscription_remain)}${other.subscription_total != null ? ` / ${formatUsageLogQuotaDisplay(other.subscription_total)}` : ''}`}
                    mono
                  />
                )}
              </DetailSection>
            )}

            {/* Param override (admin only) */}
            {props.isAdmin &&
              other?.po &&
              Array.isArray(other.po) &&
              other.po.length > 0 && (
                <DetailSection
                  icon={<Settings2 className='size-3.5' aria-hidden='true' />}
                  label={`${t('Param Override')} (${other.po.length})`}
                >
                  {other.po.filter(Boolean).map((line, idx) => {
                    const parsed = parseAuditLine(line)
                    if (!parsed) return null
                    return (
                      <div
                        key={idx}
                        className={usageLogsDialogParamOverrideRowClassName}
                      >
                        <StatusBadge
                          variant='neutral'
                          label={getParamOverrideActionLabel(parsed.action, t)}
                          className='shrink-0 font-medium'
                          copyable={false}
                        />
                        <span className={usageLogsDialogParamOverrideContentClassName}>
                          {parsed.content}
                        </span>
                      </div>
                    )
                  })}
                </DetailSection>
              )}

            {/* Content */}
            {rawDetails && (
              <div className='space-y-1.5'>
                <Label className={usageLogsDialogSectionLabelClassName}>
                  {t('usageLogs.dialog.content')}
                </Label>
                <div className={usageLogsDialogContentPanelClassName}>
                  <Button
                    variant='ghost'
                    size='sm'
                    className={usageLogsDialogCopyButtonClassName}
                    onClick={() => copyToClipboard(rawDetails)}
                    title={t('usageLogs.action.copy')}
                    aria-label={t('usageLogs.action.copy')}
                  >
                    {copiedText === rawDetails ? (
                      <Check className='size-3.5 text-emerald-700' />
                    ) : (
                      <Copy className='size-3.5' />
                    )}
                  </Button>
                  <p className={usageLogsDialogContentTextClassName}>
                    {displayDetails}
                  </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function isDisplayableType(type: number): boolean {
  return [0, 2, 5, 6].includes(type)
}
