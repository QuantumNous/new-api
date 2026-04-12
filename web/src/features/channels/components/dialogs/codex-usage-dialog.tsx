import { useMemo, useState } from 'react'
import {
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  User,
  Mail,
  Hash,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import dayjs from '@/lib/dayjs'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { StatusBadge, type StatusBadgeProps } from '@/components/status-badge'

type CodexRateLimitWindow = {
  used_percent?: number
  reset_at?: number
  reset_after_seconds?: number
  limit_window_seconds?: number
}

type CodexUsagePayload = {
  plan_type?: string
  user_id?: string
  email?: string
  account_id?: string
  rate_limit?: {
    plan_type?: string
    allowed?: boolean
    limit_reached?: boolean
    primary_window?: CodexRateLimitWindow
    secondary_window?: CodexRateLimitWindow
  }
}

export type CodexUsageDialogData = {
  success: boolean
  message?: string
  upstream_status?: number
  data?: Record<string, unknown>
}

type CodexUsageDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  channelName?: string
  channelId?: number
  response: CodexUsageDialogData | null
  onRefresh?: () => void
  isRefreshing?: boolean
}

function clampPercent(value: unknown): number {
  const v = Number(value)
  return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0
}

function formatUnixSeconds(unixSeconds: unknown): string {
  const v = Number(unixSeconds)
  if (!Number.isFinite(v) || v <= 0) return '-'
  try {
    return dayjs(v * 1000).format('YYYY-MM-DD HH:mm:ss')
  } catch {
    return String(unixSeconds)
  }
}

function formatDurationSeconds(
  seconds: unknown,
  t: (key: string) => string
): string {
  const s = Number(seconds)
  if (!Number.isFinite(s) || s <= 0) return '-'

  const total = Math.floor(s)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60

  if (hours > 0) return `${hours}${t('h')} ${minutes}${t('m')}`
  if (minutes > 0) return `${minutes}${t('m')} ${secs}${t('s')}`
  return `${secs}${t('s')}`
}

function normalizePlanType(value: unknown): string {
  if (value == null) return ''
  return String(value).trim().toLowerCase()
}

function classifyWindowByDuration(
  windowData?: CodexRateLimitWindow | null
): 'weekly' | 'fiveHour' | null {
  const seconds = Number(windowData?.limit_window_seconds)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return seconds >= 24 * 60 * 60 ? 'weekly' : 'fiveHour'
}

function resolveRateLimitWindows(data: CodexUsagePayload | null): {
  fiveHourWindow: CodexRateLimitWindow | null
  weeklyWindow: CodexRateLimitWindow | null
} {
  const rateLimit = data?.rate_limit ?? {}
  const primary = rateLimit?.primary_window ?? null
  const secondary = rateLimit?.secondary_window ?? null
  const windows = [primary, secondary].filter(Boolean) as CodexRateLimitWindow[]
  const planType = normalizePlanType(data?.plan_type ?? rateLimit?.plan_type)

  let fiveHourWindow: CodexRateLimitWindow | null = null
  let weeklyWindow: CodexRateLimitWindow | null = null

  for (const w of windows) {
    const bucket = classifyWindowByDuration(w)
    if (bucket === 'fiveHour' && !fiveHourWindow) {
      fiveHourWindow = w
      continue
    }
    if (bucket === 'weekly' && !weeklyWindow) {
      weeklyWindow = w
    }
  }

  if (planType === 'free') {
    if (!weeklyWindow) weeklyWindow = primary ?? secondary ?? null
    return { fiveHourWindow: null, weeklyWindow }
  }

  if (!fiveHourWindow && !weeklyWindow) {
    return { fiveHourWindow: primary, weeklyWindow: secondary }
  }

  if (!fiveHourWindow) {
    fiveHourWindow = windows.find((w) => w !== weeklyWindow) ?? null
  }
  if (!weeklyWindow) {
    weeklyWindow = windows.find((w) => w !== fiveHourWindow) ?? null
  }

  return { fiveHourWindow, weeklyWindow }
}

const PLAN_TYPE_BADGE: Record<
  string,
  { label: string; variant: StatusBadgeProps['variant'] }
> = {
  enterprise: { label: 'Enterprise', variant: 'success' },
  team: { label: 'Team', variant: 'info' },
  pro: { label: 'Pro', variant: 'blue' },
  plus: { label: 'Plus', variant: 'purple' },
  free: { label: 'Free', variant: 'warning' },
}

function getAccountTypeBadge(
  value: unknown,
  t: (key: string) => string
): { label: string; variant: StatusBadgeProps['variant'] } {
  const normalized = normalizePlanType(value)
  return (
    PLAN_TYPE_BADGE[normalized] ?? {
      label: String(value || '') || t('Unknown'),
      variant: 'neutral' as const,
    }
  )
}

function windowLabel(windowData?: CodexRateLimitWindow | null) {
  const percent = clampPercent(windowData?.used_percent)
  const variant: StatusBadgeProps['variant'] =
    percent >= 95 ? 'danger' : percent >= 80 ? 'warning' : 'info'
  return { percent, variant }
}

type RateLimitWindowProps = {
  title: string
  window?: CodexRateLimitWindow | null
}

function RateLimitWindow(props: RateLimitWindowProps) {
  const { t } = useTranslation()
  const hasData =
    !!props.window &&
    typeof props.window === 'object' &&
    Object.keys(props.window).length > 0
  const { percent, variant } = windowLabel(props.window)

  return (
    <div className='rounded-lg border p-4'>
      <div className='flex items-center justify-between gap-2'>
        <div className='text-sm font-medium'>{props.title}</div>
        <StatusBadge label={`${percent}%`} variant={variant} copyable={false} />
      </div>
      <div className='mt-3'>
        <Progress
          value={percent}
          aria-label={`${props.title} usage: ${percent}%`}
        />
      </div>
      {hasData ? (
        <div className='text-muted-foreground mt-2 space-y-1 text-xs'>
          <div>
            {t('Reset at:')} {formatUnixSeconds(props.window?.reset_at)}
          </div>
          <div>
            {t('Resets in:')}{' '}
            {formatDurationSeconds(props.window?.reset_after_seconds, t)}
          </div>
          <div>
            {t('Window:')}{' '}
            {formatDurationSeconds(props.window?.limit_window_seconds, t)}
          </div>
        </div>
      ) : (
        <div className='text-muted-foreground mt-2 text-xs'>-</div>
      )}
    </div>
  )
}

function CopyableField(props: {
  icon: React.ReactNode
  label: string
  value?: string | null
  mono?: boolean
}) {
  const { copyToClipboard, copiedText } = useCopyToClipboard({ notify: false })
  const text = props.value?.trim() || ''
  const hasCopied = copiedText === text

  return (
    <div className='flex items-center justify-between gap-2 py-1'>
      <div className='flex min-w-0 items-center gap-2'>
        <span className='text-muted-foreground flex-shrink-0'>
          {props.icon}
        </span>
        <span className='text-muted-foreground flex-shrink-0 text-xs'>
          {props.label}
        </span>
        <span
          className={`min-w-0 truncate text-xs ${props.mono ? 'font-mono' : ''}`}
        >
          {text || '-'}
        </span>
      </div>
      {text && (
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='h-6 w-6 flex-shrink-0 p-0'
          onClick={() => copyToClipboard(text)}
        >
          {hasCopied ? (
            <Check className='h-3 w-3 text-green-600' />
          ) : (
            <Copy className='h-3 w-3' />
          )}
        </Button>
      )}
    </div>
  )
}

export function CodexUsageDialog({
  open,
  onOpenChange,
  channelName,
  channelId,
  response,
  onRefresh,
  isRefreshing,
}: CodexUsageDialogProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })
  const [showRawJson, setShowRawJson] = useState(false)

  const payload: CodexUsagePayload | null = useMemo(() => {
    const raw = response?.data
    if (!raw || typeof raw !== 'object') return null
    return raw as CodexUsagePayload
  }, [response?.data])

  const rateLimit = payload?.rate_limit
  const { fiveHourWindow, weeklyWindow } = resolveRateLimitWindows(payload)
  const accountType = payload?.plan_type ?? rateLimit?.plan_type
  const accountBadge = getAccountTypeBadge(accountType, t)

  const statusBadge = (() => {
    if (!rateLimit || Object.keys(rateLimit).length === 0) {
      return (
        <StatusBadge label={t('Pending')} variant='neutral' copyable={false} />
      )
    }
    if (rateLimit.allowed && !rateLimit.limit_reached) {
      return (
        <StatusBadge
          label={t('Available')}
          variant='success'
          copyable={false}
        />
      )
    }
    return (
      <StatusBadge label={t('Limited')} variant='danger' copyable={false} />
    )
  })()

  const errorMessage =
    response?.success === false
      ? response?.message?.trim() || t('Failed to fetch usage')
      : ''

  const rawJsonText = useMemo(() => {
    if (!response) return ''
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
      return String(response?.data ?? '')
    }
  }, [response])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            {t('Codex Account & Usage')}
          </DialogTitle>
          <DialogDescription>
            {t('Channel:')} <strong>{channelName || '-'}</strong>{' '}
            {channelId ? `(#${channelId})` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {errorMessage && (
            <div className='rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400'>
              {errorMessage}
            </div>
          )}

          {/* Account summary */}
          <div className='rounded-lg border p-4'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <div className='flex flex-wrap items-center gap-2'>
                <StatusBadge
                  label={accountBadge.label}
                  variant={accountBadge.variant}
                  copyable={false}
                />
                {statusBadge}
                {typeof response?.upstream_status === 'number' && (
                  <StatusBadge
                    label={`${t('Status:')} ${response.upstream_status}`}
                    variant='neutral'
                    copyable={false}
                  />
                )}
              </div>
              {onRefresh && (
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={onRefresh}
                  disabled={Boolean(isRefreshing)}
                >
                  <RefreshCw className='mr-1.5 h-3.5 w-3.5' />
                  {t('Refresh')}
                </Button>
              )}
            </div>

            {/* Account identity info */}
            <div className='bg-muted/30 mt-3 rounded-md px-3 py-2'>
              <CopyableField
                icon={<User className='h-3.5 w-3.5' />}
                label='User ID'
                value={payload?.user_id}
                mono
              />
              <CopyableField
                icon={<Mail className='h-3.5 w-3.5' />}
                label={t('Email')}
                value={payload?.email}
              />
              <CopyableField
                icon={<Hash className='h-3.5 w-3.5' />}
                label='Account ID'
                value={payload?.account_id}
                mono
              />
            </div>
          </div>

          {/* Rate limit windows */}
          <div>
            <div className='mb-2 text-sm font-medium'>
              {t('Rate Limit Windows')}
            </div>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <RateLimitWindow
                title={t('5-Hour Window')}
                window={fiveHourWindow}
              />
              <RateLimitWindow
                title={t('Weekly Window')}
                window={weeklyWindow}
              />
            </div>
          </div>

          {/* Raw JSON collapsible */}
          <div className='rounded-lg border'>
            <button
              type='button'
              className='hover:bg-muted/40 flex w-full items-center justify-between gap-2 p-3 transition-colors'
              onClick={() => setShowRawJson((v) => !v)}
            >
              <div className='text-sm font-medium'>{t('Raw JSON')}</div>
              {showRawJson ? (
                <ChevronUp className='text-muted-foreground h-4 w-4' />
              ) : (
                <ChevronDown className='text-muted-foreground h-4 w-4' />
              )}
            </button>
            {showRawJson && (
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
                      <Check className='mr-1.5 h-3.5 w-3.5 text-green-600' />
                    ) : (
                      <Copy className='mr-1.5 h-3.5 w-3.5' />
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
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            {t('Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
