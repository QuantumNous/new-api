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
import { CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatUseTime } from '@/lib/format'
import { cn } from '@/lib/utils'

import { getFirstResponseTimeColor, getResponseTimeColor } from '../lib/format'
import type { LogOtherData } from '../types'

type TimingVariant = 'success' | 'warning' | 'destructive' | 'neutral'

const timingTextColorMap: Record<TimingVariant, string> = {
  success: 'text-status-success',
  warning: 'text-status-warning',
  destructive: 'text-status-destructive',
  neutral: 'text-muted-foreground',
}

interface TimingMetricsCellProps {
  useTimeSec: number
  completionTokens: number
  frtMs?: number
  isStream: boolean
  className?: string
}

/**
 * Two-line timing readout for request logs: first-token latency (stream
 * requests only) and total duration, each colored by the shared
 * response-time thresholds.
 */
export function TimingMetricsCell(props: TimingMetricsCellProps) {
  const { t } = useTranslation()
  const showFirstToken = props.isStream
  const firstTokenSeconds =
    props.frtMs != null && props.frtMs > 0 ? props.frtMs / 1000 : null
  const firstTokenVariant: TimingVariant =
    firstTokenSeconds == null
      ? 'neutral'
      : getFirstResponseTimeColor(firstTokenSeconds)
  const totalTimeVariant: TimingVariant = getResponseTimeColor(
    props.useTimeSec,
    props.completionTokens
  )
  const firstTokenLabel =
    firstTokenSeconds == null ? t('N/A') : formatUseTime(firstTokenSeconds)
  const totalTimeLabel = formatUseTime(props.useTimeSec)

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col justify-center gap-0.5 text-xs leading-tight',
        props.className
      )}
    >
      {showFirstToken && (
        <div className='flex items-baseline gap-1.5'>
          <span className='text-subtle-foreground shrink-0'>
            {t('First token')}
          </span>
          <span
            className={cn(
              'tabular-nums',
              timingTextColorMap[firstTokenVariant]
            )}
          >
            {firstTokenLabel}
          </span>
        </div>
      )}
      <div className='flex items-baseline gap-1.5'>
        <span className='text-subtle-foreground shrink-0'>{t('Duration')}</span>
        <span
          className={cn('tabular-nums', timingTextColorMap[totalTimeVariant])}
        >
          {totalTimeLabel}
        </span>
      </div>
    </div>
  )
}

interface StreamTpsCellProps {
  isStream: boolean
  tokensPerSecond?: number | null
  streamStatus?: LogOtherData['stream_status']
  className?: string
}

export function StreamTpsCell(props: StreamTpsCellProps) {
  const { t } = useTranslation()
  const showStreamError =
    props.isStream && props.streamStatus && props.streamStatus.status !== 'ok'
  const tpsLabel =
    props.tokensPerSecond != null
      ? `${Math.round(props.tokensPerSecond)} t/s`
      : '—'

  return (
    <div
      className={cn(
        'flex shrink-0 flex-col items-start justify-center gap-0.5 text-xs leading-tight',
        props.className
      )}
    >
      <span className='inline-flex items-center gap-1'>
        <StatusBadge variant={props.isStream ? 'info' : 'neutral'} size='sm'>
          {props.isStream ? t('Stream') : t('Non-stream')}
        </StatusBadge>
        {showStreamError && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={<CircleAlert className='text-destructive size-3' />}
              />
              <TooltipContent>
                <div className='space-y-0.5 text-xs'>
                  <p>
                    {t('Stream Status')}: {t('Error')}
                  </p>
                  <p>{props.streamStatus?.end_reason || 'unknown'}</p>
                  {(props.streamStatus?.error_count ?? 0) > 0 && (
                    <p>
                      {t('Soft Errors')}: {props.streamStatus?.error_count}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </span>
      <span className='text-subtle-foreground tabular-nums'>{tpsLabel}</span>
    </div>
  )
}
