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

import {
  dotColorMap,
  textColorMap,
  type StatusVariant,
} from '@/components/status-badge'
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

/**
 * Softened fills for the full-height timing bar. The bar sits directly beside
 * dense numeric text, so the saturated `dotColorMap` tones (tuned for small
 * dots and badges) read as too high-contrast at that size; a translucent fill
 * keeps the status legible while matching the page's muted palette.
 */
const barColorMap: Record<StatusVariant, string> = {
  ...dotColorMap,
  success: 'bg-success/90',
  warning: 'bg-warning/80',
  danger: 'bg-destructive/80',
  neutral: 'bg-neutral/80',
}

interface TimingMetricsCellProps {
  useTimeSec: number
  completionTokens: number
  frtMs?: number
  isStream: boolean
  className?: string
  /**
   * `bar` (default) draws a full-height color segment beside the labels,
   * matching the dense desktop table. `dot` swaps that segment for small
   * status dots inline with each label, matching the lighter-weight status
   * indicator used elsewhere on the mobile card.
   */
  indicator?: 'bar' | 'dot'
}

export function TimingMetricsCell(props: TimingMetricsCellProps) {
  const { t } = useTranslation()
  const indicator = props.indicator ?? 'bar'
  const showFirstToken = props.isStream
  const firstTokenSeconds =
    props.frtMs != null && props.frtMs > 0 ? props.frtMs / 1000 : null
  const firstTokenVariant: StatusVariant =
    firstTokenSeconds == null
      ? 'neutral'
      : getFirstResponseTimeColor(firstTokenSeconds)
  const hasTotalTime = Number.isFinite(props.useTimeSec) && props.useTimeSec > 0
  const totalTimeVariant: StatusVariant = hasTotalTime
    ? getResponseTimeColor(props.useTimeSec, props.completionTokens)
    : 'neutral'
  const firstTokenLabel =
    firstTokenSeconds == null ? t('N/A') : formatUseTime(firstTokenSeconds)
  const totalTimeLabel = hasTotalTime
    ? formatUseTime(props.useTimeSec)
    : t('N/A')

  const labels = (
    <div className='flex min-h-8 min-w-0 flex-col justify-center gap-0.5 text-xs leading-tight'>
      {showFirstToken && (
        <div className='flex items-baseline gap-1.5'>
          {indicator === 'dot' && (
            <span
              aria-hidden
              className={cn(
                'size-1.5 shrink-0 rounded-full',
                dotColorMap[firstTokenVariant]
              )}
            />
          )}
          <span className='text-muted-foreground shrink-0'>
            {t('First token')}
          </span>
          <span className={cn('tabular-nums', textColorMap[firstTokenVariant])}>
            {firstTokenLabel}
          </span>
        </div>
      )}
      <div className='flex items-baseline gap-1.5'>
        {indicator === 'dot' && (
          <span
            aria-hidden
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              dotColorMap[totalTimeVariant]
            )}
          />
        )}
        <span className='text-muted-foreground shrink-0'>{t('Duration')}</span>
        <span className={cn('tabular-nums', textColorMap[totalTimeVariant])}>
          {totalTimeLabel}
        </span>
      </div>
    </div>
  )

  if (indicator === 'dot') {
    return (
      <div className={cn('flex items-stretch', props.className)}>{labels}</div>
    )
  }

  return (
    <div className={cn('flex items-stretch gap-2', props.className)}>
      <span
        aria-hidden
        className={cn(
          'flex w-1 shrink-0 flex-col overflow-hidden rounded-full',
          !showFirstToken && barColorMap[totalTimeVariant]
        )}
      >
        {showFirstToken && (
          <>
            <span className={cn('flex-1', barColorMap[firstTokenVariant])} />
            <span className={cn('flex-1', barColorMap[totalTimeVariant])} />
          </>
        )}
      </span>
      {labels}
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
  // 'canceled' means the connection ended with zero stream errors — ordinary
  // traffic (and billed normally), not a failure. Only a real 'error' warrants
  // the destructive treatment; canceled gets a muted marker so a disconnect is
  // still visible without reading as an outage.
  const streamStatus = props.isStream ? props.streamStatus : undefined
  const isStreamError = streamStatus != null && streamStatus.status === 'error'
  const isStreamCanceled =
    streamStatus != null && streamStatus.status === 'canceled'
  const showStreamMarker = isStreamError || isStreamCanceled
  const tpsLabel =
    props.tokensPerSecond != null
      ? `${Math.round(props.tokensPerSecond)} t/s`
      : '—'
  const streamLabel = props.isStream ? t('Stream') : t('Non-stream')

  return (
    <div
      className={cn(
        'flex shrink-0 flex-col items-start justify-center gap-0.5 text-xs leading-tight',
        props.className
      )}
    >
      <span
        className={cn(
          'inline-flex items-center gap-1 font-medium',
          props.isStream ? 'text-info' : 'text-muted-foreground'
        )}
      >
        {streamLabel}
        {showStreamMarker && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <CircleAlert
                    className={cn(
                      'size-3',
                      isStreamError ? 'text-destructive' : 'text-warning'
                    )}
                  />
                }
              />
              <TooltipContent>
                <div className='space-y-0.5 text-xs'>
                  <p>
                    {t('Stream Status')}:{' '}
                    {isStreamError ? t('Error') : t('Canceled')}
                  </p>
                  <p>{streamStatus?.end_reason || 'unknown'}</p>
                  {isStreamCanceled && (
                    <p className='text-muted-foreground'>
                      {t(
                        'Connection ended without a stream error (the caller may have disconnected, or the connection was dropped in transit).'
                      )}
                    </p>
                  )}
                  {(streamStatus?.error_count ?? 0) > 0 && (
                    <p>
                      {t('Soft Errors')}: {streamStatus?.error_count}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </span>
      <span className='text-muted-foreground/60 px-0.5 tabular-nums'>
        {tpsLabel}
      </span>
    </div>
  )
}
