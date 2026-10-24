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
import { Activity } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getSelfRealtimeDimensions,
  getSelfRealtimeMetrics,
  getTeamRealtimeMetrics,
} from '@/features/dashboard/api'
import type {
  RealtimeBucket,
  RealtimeDimensions,
  RealtimeSnapshot,
} from '@/features/dashboard/types'
import { toIntlLocale } from '@/i18n/languages'
import { formatCompactNumber, formatNumber } from '@/lib/format'

import {
  RealtimeFilterBar,
  type RealtimeFilterValue,
} from './realtime-filter-bar'
import { RealtimeTrendChart } from './realtime-trend-chart'

/**
 * How often the realtime panel refetches. The backend aggregates into ten
 * second slots, so polling faster than that would only ever return the same
 * numbers; five seconds keeps the cards feeling live without adding load.
 */
const REALTIME_POLL_INTERVAL_MS = 5000

/**
 * How often the key / model option lists refresh. They change only when an
 * account starts using a new key or model, so polling them as fast as the
 * counters would spend a request every five seconds to redraw the same
 * dropdown.
 */
const REALTIME_DIMENSIONS_POLL_INTERVAL_MS = 60_000

/** Max characters a card value may take before it is compacted. */
const MAX_INLINE_STAT_CHARS = 9

/** The three trailing windows the backend reports, keyed by window_seconds. */
const WINDOW_LABELS = [
  { windowSeconds: 60, labelKey: '1 min' },
  { windowSeconds: 300, labelKey: '5 min' },
  { windowSeconds: 3600, labelKey: '1 hour' },
] as const

function formatStatNumber(value: number, locale: Intl.LocalesArgument) {
  const fullValue = formatNumber(value, locale)
  const displayValue =
    fullValue.length > MAX_INLINE_STAT_CHARS
      ? formatCompactNumber(value, locale)
      : fullValue

  return { displayValue, fullValue }
}

/** Fixed one-decimal rate; RPM and TPM are small enough that more is noise. */
function formatRate(value: number, locale: Intl.LocalesArgument) {
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(value)

  return formatted
}

/**
 * Render the cache hit rate, or a placeholder when it was never measured.
 *
 * The backend sends null when no request in the window reported cache
 * metadata. That is not the same as a 0% hit rate, so it must not be formatted
 * as one: a user whose upstream simply does not report caching would otherwise
 * read a confident "0%" and conclude their cache is broken.
 */
function formatCacheHitRate(
  value: number | null,
  locale: Intl.LocalesArgument
) {
  if (value == null) return '--'
  const percent = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(value * 100)

  return `${percent}%`
}

/**
 * Drop the bucket for the minute currently in progress.
 *
 * Every bucket in the series is one minute wide, so its raw count is already a
 * per-minute rate and needs no further division. The trailing bucket is the
 * exception: it has only been accumulating for the seconds elapsed since the
 * minute began, so plotting it would draw a hard dip at the right edge that
 * says nothing about throughput. The backend keeps that partial bucket so the
 * series still reconciles with the 1-hour card, which is why the trimming
 * happens here, at the point of display.
 *
 * The leading bucket can also be short, because the ring's six-hour coverage
 * is aligned to ten-second slots rather than to the minute grid. It is left in
 * place: unlike the trailing one, it is only ever a few seconds short, and
 * dropping it would shorten an already sparse sixty-point series.
 */
function dropPartialTrailingBucket(series: RealtimeBucket[]) {
  return series.length > 1 ? series.slice(0, -1) : []
}

interface RealtimeMetricsPanelProps {
  isTeamView?: boolean
}

/**
 * Realtime RPM / TPM over the last minute, five minutes and hour.
 *
 * When isTeamView is true the panel shows aggregate traffic for the parent
 * account and all currently-bound children by calling the team endpoint.
 * The key/model filter bar is hidden in team view because the aggregated
 * ring data does not map to a single user's key selection.
 */
export function RealtimeMetricsPanel({ isTeamView = false }: RealtimeMetricsPanelProps) {
  const { i18n, t } = useTranslation()
  const [snapshot, setSnapshot] = useState<RealtimeSnapshot | null>(null)
  const [dimensions, setDimensions] = useState<RealtimeDimensions | null>(null)
  const [filter, setFilter] = useState<RealtimeFilterValue>({
    tokenId: 0,
    model: '',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const { tokenId, model } = filter

  useEffect(() => {
    let cancelled = false
    const abortController = new AbortController()
    abortRef.current = abortController

    const poll = async () => {
      try {
        const res = isTeamView
          ? await getTeamRealtimeMetrics()
          : await getSelfRealtimeMetrics({ tokenId, model })
        if (cancelled) return
        setSnapshot(res?.data ?? null)
        setError(false)
      } catch {
        if (cancelled) return
        setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void poll()
    const timer = setInterval(() => {
      void poll()
    }, REALTIME_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
      abortController.abort()
    }
  }, [isTeamView, tokenId, model])

  // The option lists are only meaningful in self view; in team view there is no
  // per-key filter, so skip the fetch entirely.
  useEffect(() => {
    if (isTeamView) return

    let cancelled = false

    const loadDimensions = async () => {
      try {
        const res = await getSelfRealtimeDimensions()
        if (!cancelled) setDimensions(res?.data ?? null)
      } catch {
        // A failed option load leaves the pickers as they were; the metrics
        // themselves are unaffected and reporting it twice would be noise.
      }
    }

    void loadDimensions()
    const timer = setInterval(() => {
      void loadDimensions()
    }, REALTIME_DIMENSIONS_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [isTeamView])

  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)

  const windows = useMemo(() => {
    const byLength = new Map(
      (snapshot?.windows ?? []).map((w) => [w.window_seconds, w])
    )
    return WINDOW_LABELS.map((entry) => ({
      ...entry,
      metrics: byLength.get(entry.windowSeconds),
    }))
  }, [snapshot])

  const hasAnyTraffic = windows.some((w) => (w.metrics?.requests ?? 0) > 0)

  // The filter bar is only shown in self view. In team view the aggregated data
  // spans all members' keys so a single-key filter is not meaningful.
  const hasFilterOptions =
    !isTeamView &&
    ((dimensions?.tokens.length ?? 0) > 0 || (dimensions?.models.length ?? 0) > 0)

  const trendSeries = useMemo(
    () => dropPartialTrailingBucket(snapshot?.series ?? []),
    [snapshot]
  )

  // One note at a time, in priority order: a fetch failure is more useful to
  // report than an empty window, and an empty window more useful than the
  // generic retention hint.
  let footerNote = t(
    'Counters cover the last 6 hours and reset when this node restarts.'
  )
  if (error) {
    footerNote = t('Realtime data unavailable')
  } else if (!loading && !hasAnyTraffic) {
    // Distinguish "this account is idle" from "this key/model is idle", or a
    // user who filtered to a quiet key would read it as the whole account
    // having stopped.
    footerNote =
      tokenId > 0 || model
        ? t('No requests recorded for this selection in the last hour.')
        : t('No requests recorded in the last hour.')
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex flex-col gap-1.5 border-b px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-3'>
        <div className='flex items-center gap-2'>
          <IconBadge tone='chart-3' size='sm'>
            <Activity />
          </IconBadge>
          <div className='text-sm font-semibold'>
            {t('Realtime Throughput')}
          </div>
          <span className='text-muted-foreground text-xs'>
            {t('Updates every {{seconds}}s', {
              seconds: REALTIME_POLL_INTERVAL_MS / 1000,
            })}
          </span>
        </div>
        {snapshot?.node_name ? (
          <span className='text-muted-foreground text-xs'>
            {t('Node:')} {snapshot.node_name}
          </span>
        ) : null}
      </div>

      {hasFilterOptions ? (
        <div className='flex flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-5'>
          <RealtimeFilterBar
            dimensions={dimensions}
            value={filter}
            onChange={setFilter}
          />
        </div>
      ) : null}

      <div className='divide-border/60 grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0'>
        {windows.map((entry) => {
          const requests = entry.metrics?.requests ?? 0
          const tokens = entry.metrics?.tokens ?? 0
          const rpm = formatRate(entry.metrics?.rpm ?? 0, locale)
          const tpm = formatRate(entry.metrics?.tpm ?? 0, locale)
          const requestsDisplay = formatStatNumber(requests, locale)
          const tokensDisplay = formatStatNumber(tokens, locale)
          const cacheHitRate = entry.metrics?.cache_hit_rate ?? null
          const cacheHitRateDisplay = formatCacheHitRate(cacheHitRate, locale)
          const cacheReadDisplay = formatStatNumber(
            entry.metrics?.cache_read_tokens ?? 0,
            locale
          )
          const cacheInputDisplay = formatStatNumber(
            entry.metrics?.input_tokens_total ?? 0,
            locale
          )
          // Spell the ratio out on hover. The percentage alone hides how thin
          // the sample is, and a 100% rate over 12 tokens deserves less trust
          // than the same number over a million.
          const cacheHitRateTitle =
            cacheHitRate == null
              ? t('No cache data reported in this window')
              : `${cacheReadDisplay.fullValue} / ${cacheInputDisplay.fullValue} ${t('cached input tokens')}`

          return (
            <div
              key={entry.windowSeconds}
              className='px-3 py-3 sm:px-5 sm:py-4'
            >
              <div className='text-muted-foreground text-[11px] font-medium tracking-wide uppercase sm:text-xs sm:tracking-wider'>
                {t(entry.labelKey)}
              </div>

              {loading ? (
                <div className='mt-2 flex flex-col gap-1.5'>
                  <Skeleton className='h-6 w-24' />
                  <Skeleton className='h-4 w-32' />
                </div>
              ) : (
                <>
                  <div className='mt-2 grid grid-cols-2 gap-x-4 gap-y-1'>
                    <div
                      className='text-foreground truncate font-mono text-base leading-tight font-bold tracking-tight tabular-nums sm:text-xl'
                      title={`${requestsDisplay.fullValue} RPM`}
                    >
                      {rpm}
                      <span className='text-muted-foreground ml-1 text-xs font-medium'>
                        RPM
                      </span>
                    </div>
                    <div
                      className='text-foreground truncate font-mono text-base leading-tight font-bold tracking-tight tabular-nums sm:text-xl'
                      title={`${tokensDisplay.fullValue} TPM`}
                    >
                      {tpm}
                      <span className='text-muted-foreground ml-1 text-xs font-medium'>
                        TPM
                      </span>
                    </div>
                  </div>

                  <div
                    className='mt-1.5 flex items-baseline gap-1.5'
                    title={cacheHitRateTitle}
                  >
                    <span
                      className={`truncate font-mono text-sm leading-tight font-bold tracking-tight tabular-nums sm:text-base ${
                        cacheHitRate == null
                          ? 'text-muted-foreground'
                          : 'text-foreground'
                      }`}
                    >
                      {cacheHitRateDisplay}
                    </span>
                    <span className='text-muted-foreground text-[11px] font-medium tracking-wide uppercase'>
                      {t('Cache Hit Rate')}
                    </span>
                  </div>

                  <div className='text-muted-foreground/70 mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums'>
                    <span>
                      {requestsDisplay.displayValue} {t('requests')}
                    </span>
                    <span>
                      {tokensDisplay.displayValue} {t('tokens')}
                    </span>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      <RealtimeTrendChart
        series={trendSeries}
        loading={loading}
        locale={locale}
      />

      <div className='text-muted-foreground/60 border-t px-3 py-2 text-xs sm:px-5'>
        {footerNote}
      </div>
    </div>
  )
}
