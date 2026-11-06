import { Check, ChevronDown, ChevronUp, Copy, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { StatusBadge, type StatusBadgeProps } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import dayjs from '@/lib/dayjs'
import { formatNumber } from '@/lib/format'
import { getServerMessage } from '@/lib/server-error-message'

import type { CopilotUsageResponse } from '../../api'
import { UsageInfoField } from './usage-info-field'

const SENSITIVE_MASK = '••••'

type CopilotQuotaSnapshot = {
  percent_remaining?: number
  quota_remaining?: number
  remaining?: number
  entitlement?: number
  credits_used?: number
  has_quota?: boolean
  unlimited?: boolean
}

type CopilotUsagePayload = {
  id?: number | string
  login?: string
  access_type_sku?: string
  copilot_plan?: string
  chat_enabled?: boolean
  cli_enabled?: boolean
  can_upgrade_plan?: boolean
  token_based_billing?: boolean
  quota_reset_date?: string
  quota_reset_at?: number
  quota_snapshots?: Record<string, CopilotQuotaSnapshot>
}

type CopilotUsageDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  channelName?: string
  channelId?: number
  channelDisplayName?: string
  channelDisplayId?: string
  sensitiveVisible?: boolean
  response: CopilotUsageResponse | null
  onRefresh?: () => void | Promise<void>
  isRefreshing?: boolean
}

export type CopilotUsageDialogData = CopilotUsageResponse

function numberValue(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function clampPercent(value: unknown): number {
  const parsed = numberValue(value)
  return parsed == null ? 0 : Math.max(0, Math.min(100, parsed))
}

function formatResetDate(value: unknown, fallback?: unknown): string {
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = dayjs(value)
    if (parsed.isValid()) {
      return parsed.format('YYYY-MM-DD')
    }
    return value
  }
  const resetAt = numberValue(fallback)
  if (resetAt != null && resetAt > 0) {
    return dayjs.unix(resetAt).format('YYYY-MM-DD')
  }
  return '-'
}

function maskSensitiveValue<T extends string | number>(
  value: T | undefined,
  sensitiveVisible: boolean
): T | string | undefined {
  if (sensitiveVisible) {
    return value
  }
  return value == null || value === '' ? undefined : SENSITIVE_MASK
}

function quotaLabel(key: string, t: (key: string) => string): string {
  const labels: Record<string, string> = {
    chat: t('Chat'),
    completions: t('Completions'),
    premium_interactions: t('Premium interactions'),
  }
  if (labels[key]) {
    return labels[key]
  }
  return key
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function planBadge(value: unknown): {
  label: string
  variant: StatusBadgeProps['variant']
} {
  const plan = String(value || '').trim()
  const normalized = plan.toLowerCase()
  const variants: Record<string, StatusBadgeProps['variant']> = {
    business: 'info',
    enterprise: 'success',
    free: 'warning',
    individual: 'blue',
    pro: 'purple',
  }
  return {
    label: plan || '-',
    variant: variants[normalized] ?? 'neutral',
  }
}

function quotaBadge(
  snapshot: CopilotQuotaSnapshot,
  t: (key: string) => string
): { label: string; variant: StatusBadgeProps['variant'] } {
  if (snapshot.unlimited) {
    return { label: t('Unlimited'), variant: 'info' }
  }
  if (snapshot.has_quota === false) {
    return { label: t('Not included'), variant: 'neutral' }
  }
  if (clampPercent(snapshot.percent_remaining) <= 0) {
    return { label: t('Exhausted'), variant: 'danger' }
  }
  return { label: t('Available'), variant: 'success' }
}

function QuotaCard(props: {
  quotaKey: string
  snapshot: CopilotQuotaSnapshot
  resetDate: string
}) {
  const { t } = useTranslation()
  const percent = clampPercent(props.snapshot.percent_remaining)
  const badge = quotaBadge(props.snapshot, t)
  const remaining = numberValue(
    props.snapshot.remaining ?? props.snapshot.quota_remaining
  )
  const entitlement = numberValue(props.snapshot.entitlement)
  const creditsUsed = numberValue(props.snapshot.credits_used)

  return (
    <Card size='sm' className='gap-0 py-0'>
      <CardHeader className='p-4 pb-2'>
        <CardTitle className='text-sm'>
          {quotaLabel(props.quotaKey, t)}
        </CardTitle>
        <CardAction>
          <StatusBadge
            label={badge.label}
            variant={badge.variant}
            copyable={false}
          />
        </CardAction>
      </CardHeader>
      <CardContent className='flex flex-col gap-3 p-4 pt-2'>
        <div className='text-xl font-semibold tabular-nums'>
          {props.snapshot.unlimited ? t('Unlimited') : formatNumber(remaining)}
          {!props.snapshot.unlimited && entitlement != null
            ? ` / ${formatNumber(entitlement)}`
            : null}
        </div>
        <Progress
          value={percent}
          aria-label={t('{{percent}}% remaining', {
            percent: formatNumber(percent),
          })}
        />
        <div className='text-muted-foreground flex items-center justify-between gap-3 text-xs tabular-nums'>
          <span>
            {t('{{percent}}% remaining', {
              percent: formatNumber(percent),
            })}
          </span>
          <span>
            {t('Credits used:')} {formatNumber(creditsUsed)}
          </span>
        </div>
        <div className='grid grid-cols-2 gap-2 text-xs'>
          <div>
            <div className='text-muted-foreground text-[11px]'>
              {t('Remaining')}
            </div>
            <div className='mt-1 tabular-nums'>{formatNumber(remaining)}</div>
          </div>
          <div>
            <div className='text-muted-foreground text-[11px]'>
              {t('Resets on')}
            </div>
            <div className='mt-1 tabular-nums'>{props.resetDate}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function CopilotUsageDialog({
  open,
  onOpenChange,
  channelName,
  channelId,
  channelDisplayName,
  channelDisplayId,
  sensitiveVisible = true,
  response,
  onRefresh,
  isRefreshing,
}: CopilotUsageDialogProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })
  const [showRawJson, setShowRawJson] = useState(false)

  const payload: CopilotUsagePayload | null = useMemo(() => {
    const raw = response?.data
    if (!raw || typeof raw !== 'object') {
      return null
    }
    return raw as CopilotUsagePayload
  }, [response?.data])

  const plan = planBadge(payload?.copilot_plan)
  const resetDate = formatResetDate(
    payload?.quota_reset_date,
    payload?.quota_reset_at
  )
  const channelLabelName = channelDisplayName ?? channelName ?? '-'
  let channelLabelId = ''
  if (channelDisplayId != null) {
    channelLabelId = ` (#${channelDisplayId})`
  } else if (channelId) {
    channelLabelId = ` (#${channelId})`
  }
  const channelLabel = `${channelLabelName}${channelLabelId}`
  const login = maskSensitiveValue(payload?.login, sensitiveVisible)
  const userId = maskSensitiveValue(payload?.id, sensitiveVisible)
  const quotaEntries = Object.entries(payload?.quota_snapshots ?? {}).filter(
    ([, snapshot]) => snapshot && typeof snapshot === 'object'
  )
  const errorMessage =
    response?.success === false
      ? getServerMessage(response)?.trim() || t('Failed to fetch usage')
      : ''
  const rawJsonText = useMemo(() => {
    if (!response) {
      return ''
    }
    try {
      return JSON.stringify(
        {
          success: response.success,
          message: response.message,
          upstream_status: response.upstream_status,
          data: response.data,
        },
        null,
        2
      )
    } catch {
      return String(response.data ?? '')
    }
  }, [response])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setShowRawJson(false)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t('GitHub Copilot Account & Usage')}
      contentClassName='sm:max-w-[900px]'
      contentHeight='auto'
      bodyClassName='flex flex-col gap-4'
      footer={
        <Button
          type='button'
          variant='outline'
          onClick={() => handleOpenChange(false)}
        >
          {t('Close')}
        </Button>
      }
    >
      <div className='flex flex-col gap-4'>
        {errorMessage ? (
          <div className='border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm'>
            {errorMessage}
          </div>
        ) : null}

        <Card size='sm' className='bg-muted/30 gap-0 py-0'>
          <CardHeader className='p-4 pb-2'>
            <CardTitle className='text-muted-foreground text-xs font-medium'>
              {t('GitHub Copilot Account Status')}
            </CardTitle>
            {onRefresh ? (
              <CardAction>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={onRefresh}
                  disabled={Boolean(isRefreshing)}
                >
                  <RefreshCw data-icon='inline-start' />
                  {t('Refresh')}
                </Button>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent className='p-4 pt-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <StatusBadge
                label={plan.label}
                variant={plan.variant}
                copyable={false}
              />
              {payload?.access_type_sku ? (
                <StatusBadge
                  label={payload.access_type_sku}
                  variant='neutral'
                  copyable={false}
                />
              ) : null}
              <StatusBadge
                label={`HTTP ${response?.upstream_status ?? '-'}`}
                variant='neutral'
                copyable={false}
              />
              {payload?.chat_enabled ? (
                <StatusBadge
                  label={t('Chat enabled')}
                  variant='success'
                  copyable={false}
                />
              ) : null}
              {payload?.cli_enabled ? (
                <StatusBadge
                  label={t('CLI enabled')}
                  variant='info'
                  copyable={false}
                />
              ) : null}
              {payload?.can_upgrade_plan ? (
                <StatusBadge
                  label={t('Upgrade available')}
                  variant='warning'
                  copyable={false}
                />
              ) : null}
              {payload?.token_based_billing ? (
                <StatusBadge
                  label={t('Token-based billing')}
                  variant='purple'
                  copyable={false}
                />
              ) : null}
            </div>
            <div className='mt-4 grid grid-cols-1 gap-3 md:grid-cols-2'>
              <UsageInfoField label={t('Login')} value={login} copyable />
              <UsageInfoField
                label={t('User ID')}
                value={userId == null ? undefined : String(userId)}
                mono
              />
              <UsageInfoField
                label={t('Access type')}
                value={payload?.access_type_sku}
                copyable={false}
              />
              <UsageInfoField
                label={t('Quota reset date')}
                value={resetDate}
                copyable={false}
              />
              <UsageInfoField
                label={t('Channel')}
                value={channelLabel}
                copyable={false}
                className='md:col-span-2'
              />
            </div>
          </CardContent>
        </Card>

        <div className='flex flex-col gap-3'>
          <div className='min-w-0'>
            <div className='text-sm font-semibold'>{t('Quota Snapshots')}</div>
            <div className='text-muted-foreground mt-1 text-xs leading-5'>
              {t('Usage allowance by GitHub Copilot capability.')}
            </div>
          </div>
          {quotaEntries.length > 0 ? (
            <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
              {quotaEntries.map(([key, snapshot]) => (
                <QuotaCard
                  key={key}
                  quotaKey={key}
                  snapshot={snapshot}
                  resetDate={resetDate}
                />
              ))}
            </div>
          ) : (
            <div className='text-muted-foreground rounded-lg border border-dashed p-4 text-sm'>
              {t('GitHub did not return quota details for this account.')}
            </div>
          )}
        </div>

        <Collapsible
          open={showRawJson}
          onOpenChange={setShowRawJson}
          className='rounded-lg border'
        >
          <CollapsibleTrigger
            render={
              <button
                type='button'
                className='hover:bg-muted/40 flex w-full items-center justify-between gap-2 p-3 transition-colors'
                aria-expanded={showRawJson}
              />
            }
          >
            <div className='text-sm font-medium'>{t('Raw JSON')}</div>
            {showRawJson ? (
              <ChevronUp className='text-muted-foreground h-4 w-4' />
            ) : (
              <ChevronDown className='text-muted-foreground h-4 w-4' />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <>
              <div className='flex justify-end border-t px-3 py-2'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => copyToClipboard(rawJsonText)}
                  disabled={!rawJsonText}
                >
                  {copiedText === rawJsonText ? (
                    <Check data-icon='inline-start' className='text-success' />
                  ) : (
                    <Copy data-icon='inline-start' />
                  )}
                  {t('Copy')}
                </Button>
              </div>
              <ScrollArea className='max-h-[50vh]'>
                <pre className='bg-muted/30 m-0 p-3 text-xs break-words whitespace-pre-wrap'>
                  {rawJsonText || '-'}
                </pre>
              </ScrollArea>
            </>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </Dialog>
  )
}
