import { useMemo } from 'react'
import { Copy, Check, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import dayjs from '@/lib/dayjs'
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
import { StatusBadge } from '@/components/status-badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import type { StatusBadgeProps } from '@/components/status-badge'

type CodexRateLimitWindow = {
  used_percent?: number
  reset_at?: number
  reset_after_seconds?: number
  limit_window_seconds?: number
}

type CodexUsagePayload = {
  rate_limit?: {
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
  data?: any
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

function formatDurationSeconds(seconds: unknown): string {
  const s = Number(seconds)
  if (!Number.isFinite(s) || s <= 0) return '-'

  const total = Math.floor(s)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

function windowLabel(windowData?: CodexRateLimitWindow) {
  const percent = clampPercent(windowData?.used_percent)
  const variant: StatusBadgeProps['variant'] =
    percent >= 95 ? 'danger' : percent >= 80 ? 'warning' : 'info'
  return { percent, variant }
}

type RateLimitWindowProps = {
  title: string
  window?: CodexRateLimitWindow
}

function RateLimitWindow({ title, window }: RateLimitWindowProps) {
  const { t } = useTranslation()
  const { percent, variant } = windowLabel(window)

  return (
    <div className='rounded-lg border p-4'>
      <div className='flex items-center justify-between gap-2'>
        <div className='text-sm font-medium'>{title}</div>
        <StatusBadge label={`${percent}%`} variant={variant} copyable={false} />
      </div>
      <div className='mt-3'>
        <Progress value={percent} aria-label={`${title} usage: ${percent}%`} />
      </div>
      <div className='text-muted-foreground mt-2 space-y-1 text-xs'>
        <div>
          {t('Reset at:')} {formatUnixSeconds(window?.reset_at)}
        </div>
        <div>
          {t('Resets in:')} {formatDurationSeconds(window?.reset_after_seconds)}
        </div>
        <div>
          {t('Window:')} {formatDurationSeconds(window?.limit_window_seconds)}
        </div>
      </div>
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

  const payload: CodexUsagePayload | null = useMemo(() => {
    const raw = response?.data
    if (!raw || typeof raw !== 'object') return null
    return raw as CodexUsagePayload
  }, [response?.data])

  const rateLimit = payload?.rate_limit
  const primary = rateLimit?.primary_window
  const secondary = rateLimit?.secondary_window

  const statusBadge = (() => {
    const allowed = Boolean(rateLimit?.allowed)
    const limitReached = Boolean(rateLimit?.limit_reached)
    if (allowed && !limitReached) {
      return <StatusBadge label={t('Allowed')} variant='success' copyable={false} />
    }
    return <StatusBadge label={t('Limited')} variant='danger' copyable={false} />
  })()

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
            {t('Codex Usage')}
            {statusBadge}
          </DialogTitle>
          <DialogDescription>
            {t('Channel:')} <strong>{channelName || '-'}</strong>{' '}
            {channelId ? `(#${channelId})` : ''}
            {typeof response?.upstream_status === 'number'
              ? ` - ${t('Upstream status:')} ${response.upstream_status}`
              : ''}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <RateLimitWindow title={t('Primary window')} window={primary} />
            <RateLimitWindow title={t('Secondary window')} window={secondary} />
          </div>

          <div className='rounded-lg border'>
            <div className='flex items-center justify-between gap-2 border-b p-3'>
              <div className='text-sm font-medium'>{t('Raw JSON')}</div>
              <div className='flex items-center gap-2'>
                {onRefresh && (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={onRefresh}
                    disabled={Boolean(isRefreshing)}
                  >
                    <RefreshCw className='mr-2 h-4 w-4' />
                    {t('Refresh')}
                  </Button>
                )}
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => copyToClipboard(rawJsonText)}
                  aria-label={t('Copy to clipboard')}
                  title={t('Copy to clipboard')}
                  disabled={!rawJsonText}
                >
                  {copiedText === rawJsonText ? (
                    <Check className='mr-2 h-4 w-4 text-green-600' />
                  ) : (
                    <Copy className='mr-2 h-4 w-4' />
                  )}
                  {t('Copy')}
                </Button>
              </div>
            </div>
            <ScrollArea className='max-h-[50vh]'>
              <pre className='bg-muted/30 m-0 whitespace-pre-wrap break-words p-3 text-xs'>
                {rawJsonText || '-'}
              </pre>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            {t('Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
