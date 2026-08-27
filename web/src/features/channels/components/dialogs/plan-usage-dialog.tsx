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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, ChevronUp, Copy, RefreshCw } from 'lucide-react'

import { Dialog } from '@/components/dialog'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
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
import { formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  formatPlanRemainingPercent,
  getPlanRemainingVariant,
} from '../../lib/channel-utils'
import type { ChannelPlanUsage, PlanUsageWindow } from '../../types'

type TFunction = (key: string) => string

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(100, value))
}

// Countdown until a unix-seconds reset time, using the same wording units as
// the Codex usage dialog ({{days}} / h / m / s).
function formatResetsIn(
  resetTime: number,
  now: number,
  t: TFunction
): string {
  if (!resetTime) {
    return '-'
  }
  const secondsLeft = resetTime - now
  if (secondsLeft <= 0) {
    return t('Expired')
  }
  const days = Math.floor(secondsLeft / 86400)
  const hours = Math.floor((secondsLeft % 86400) / 3600)
  const minutes = Math.floor((secondsLeft % 3600) / 60)
  const seconds = secondsLeft % 60
  if (days > 0) {
    return `${days} ${t('days')} ${hours}${t('h')}`
  }
  if (hours > 0) {
    return `${hours}${t('h')} ${minutes}${t('m')}`
  }
  if (minutes > 0) {
    return `${minutes}${t('m')} ${seconds}${t('s')}`
  }
  return `${seconds}${t('s')}`
}

const usedPercentTextClassName = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
} as const

function usedPercentVariant(percent: number): keyof typeof usedPercentTextClassName {
  if (percent >= 95) {
    return 'danger'
  }
  if (percent >= 80) {
    return 'warning'
  }
  return 'success'
}

function PlanUsageWindowRow(props: {
  title: string
  window?: PlanUsageWindow | null
  now: number
}) {
  const { t } = useTranslation()
  const hasData = !!props.window
  const percent = clampPercent(props.window?.used_percent ?? 0)
  const variant = usedPercentVariant(percent)
  const hasCredits =
    props.window?.total_quota != null || props.window?.used_quota != null
  const remainingQuota = props.window?.remaining_quota

  return (
    <Card size='sm' className='gap-0 py-0'>
      <CardHeader className='p-3 pb-2'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <CardTitle className='text-sm font-semibold'>
              {props.title}
            </CardTitle>
            <CardDescription className='mt-1 text-xs'>
              {t('Resets in:')}{' '}
              <span className='tabular-nums'>
                {hasData
                  ? formatResetsIn(props.window?.reset_time ?? 0, props.now, t)
                  : '-'}
              </span>
            </CardDescription>
          </div>
          <div className='shrink-0 text-right'>
            <div
              className={cn(
                'text-xl leading-none font-semibold tabular-nums',
                usedPercentTextClassName[variant]
              )}
            >
              {hasData ? `${percent}%` : '-'}
            </div>
            <div className='text-muted-foreground mt-1 text-[11px]'>
              {t('Used')}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className='p-3 pt-0'>
        {hasData ? (
          <Progress
            value={percent}
            aria-label={`${props.title} usage: ${percent}%`}
            className='mt-1'
          />
        ) : (
          <div className='text-muted-foreground mt-1 text-sm'>-</div>
        )}
        {hasCredits ? (
          <div className='text-muted-foreground mt-2 text-xs tabular-nums'>
            {t('Credits')}{' '}
            {props.window?.used_quota ?? 0} / {props.window?.total_quota ?? 0}
            {remainingQuota != null ? (
              <span>
                {' · '}
                {t('Remaining:')} {remainingQuota}
              </span>
            ) : null}
          </div>
        ) : null}
        {props.window?.reset_time ? (
          <div className='text-muted-foreground mt-1 text-xs'>
            {t('Reset at:')}{' '}
            <span className='tabular-nums'>
              {formatTimestampToDate(props.window.reset_time)}
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

type PlanUsageDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  channelName?: string
  usage: ChannelPlanUsage | null
  balanceUpdatedTime?: number
  onRefresh?: () => void | Promise<void>
  isRefreshing?: boolean
}

export function PlanUsageDialog(props: PlanUsageDialogProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })
  const [showRawJson, setShowRawJson] = useState(false)
  const now = Math.floor(Date.now() / 1000)

  const fiveHour = props.usage?.windows.find((w) => w.kind === 'interval_5h')
  const weekly = props.usage?.windows.find((w) => w.kind === 'weekly')
  const isMiniMax = props.usage?.provider === 'minimax'

  // Overall remaining = 100 - the max used percent across windows.
  const remainingPercent = props.usage
    ? 100 -
      Math.max(
        ...props.usage.windows.map((w) => clampPercent(w.used_percent))
      )
    : null

  const rawJsonText = useMemo(
    () => (props.usage ? JSON.stringify(props.usage, null, 2) : ''),
    [props.usage]
  )

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Plan Usage')}
      description={
        <>
          {t('Update balance for:')}
          <strong>{props.channelName}</strong>
        </>
      }
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          {props.onRefresh ? (
            <Button
              variant='outline'
              onClick={() => void props.onRefresh?.()}
              disabled={props.isRefreshing}
            >
              <RefreshCw data-icon='inline-start' />
              {props.isRefreshing ? t('Querying...') : t('Refresh')}
            </Button>
          ) : null}
          <Button
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={props.isRefreshing}
          >
            {t('Close')}
          </Button>
        </>
      }
    >
      <div className='space-y-4 py-4'>
        {props.usage === null ? (
          <div className='text-muted-foreground text-sm'>
            {props.isRefreshing ? t('Querying...') : '-'}
          </div>
        ) : (
          <>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <div className='flex flex-wrap items-center gap-2'>
                {props.usage.level ? (
                  <StatusBadge
                    label={props.usage.level}
                    variant='purple'
                    copyable={false}
                  />
                ) : null}
                {remainingPercent != null ? (
                  <StatusBadge
                    label={`${t('Remaining:')} ${formatPlanRemainingPercent(remainingPercent)}`}
                    variant={getPlanRemainingVariant(remainingPercent)}
                    copyable={false}
                  />
                ) : null}
              </div>
              <div className='text-muted-foreground text-xs'>
                {t('Last updated:')}{' '}
                {props.balanceUpdatedTime
                  ? formatTimestampToDate(props.balanceUpdatedTime)
                  : 'Never'}
              </div>
            </div>

            <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
              <PlanUsageWindowRow
                title={t('5-Hour Window')}
                window={fiveHour}
                now={now}
              />
              <PlanUsageWindowRow
                title={t('Weekly Window')}
                window={weekly}
                now={now}
              />
            </div>

            {isMiniMax && !weekly ? (
              <div className='text-muted-foreground text-xs'>
                {t('No weekly limit')}
              </div>
            ) : null}
          </>
        )}

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
            <ScrollArea className='max-h-[40vh]'>
              <pre className='bg-muted/30 m-0 p-3 text-xs break-words whitespace-pre-wrap'>
                {rawJsonText || '-'}
              </pre>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </Dialog>
  )
}
