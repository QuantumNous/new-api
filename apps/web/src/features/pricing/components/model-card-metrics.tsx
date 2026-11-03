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
import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  formatLatencyValue,
  pickLatencyUnit,
  type LatencyUnit,
} from '@/features/performance-metrics/lib/format'
import { useCountUpText } from '@/hooks/use-count-up-text'
import { cn } from '@/lib/utils'

import {
  BASE_Y,
  CHART_H,
  CHART_W,
  PAD_L,
  PAD_R,
  PAD_T,
  PLOT_H,
  PLOT_W,
  smoothLinePath,
} from '../lib/chart-geometry'
import type { ModelPerfBadgeData, ModelPerfTrendPoint } from './model-perf-badge'

const LATENCY_COLOR = '#3b82f6' // blue-500, latency bars
const SUCCESS_COLOR = '#10b981' // emerald-500, success-rate line and number
const GRID_COLOR = 'currentColor'

type ChartGeometry = {
  bars: { index: number; x: number; y: number; width: number; height: number }[]
  linePath: string
  xAt: (index: number) => number
  ySuccess: (value: number) => number
  latencyTicks: number[]
  /** One unit for the whole chart, picked from the peak latency tick. */
  latencyUnit: LatencyUnit
  successTicks: number[]
  xLabels: { index: number; label: string }[]
  band: number
}

function formatHour(ts: number): string {
  const date = new Date(ts * 1000)
  return `${String(date.getHours()).padStart(2, '0')}:00`
}

// Mantissa steps for axis rounding, in ascending order.
const NICE_STEPS = [1, 2, 2.5, 5, 10]

/** Round a raw maximum up to the next 1/2/2.5/5/10 × 10^n so axis ticks read cleanly. */
function niceCeil(value: number): number {
  if (value <= 0) return 1
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
  const normalized = value / magnitude
  const step = NICE_STEPS.find((candidate) => normalized <= candidate) ?? 10
  return step * magnitude
}
/**
 * Mini combo chart for a model-square card: blue latency bars against the
 * left axis (seconds once the peak reaches one, milliseconds below that),
 * green success-rate line against the right axis (fixed 0–100 % scale),
 * hour labels on the x axis. The headline numbers sit above the chart and
 * swap to the hovered/clicked hour; clicking pins that hour.
 *
 * Renders nothing without metrics so unsampled models stay visually clean.
 */
export const ModelCardMetrics = memo(function ModelCardMetrics(props: {
  perf: ModelPerfBadgeData | undefined
  className?: string
  /** False until the card is scrolled near the viewport; gates count-up. */
  visible?: boolean
}) {
  const { perf } = props

  const series = useMemo<ModelPerfTrendPoint[]>(
    () =>
      (perf?.recent_series ?? [])
        .filter(
          (point) =>
            Number.isFinite(point.latency_ms) &&
            Number.isFinite(point.success_rate)
        )
        .slice(-24),
    [perf]
  )

  const geometry = useMemo(() => {
    if (series.length < 2) return null

    const latencies = series.map((point) => point.latency_ms)
    const peakLatency = Math.max(...latencies)
    const latencyMax = niceCeil(peakLatency)
    const latencyTicks = [0, latencyMax / 2, latencyMax]
    // A chat request routinely takes whole seconds, so a card whose measured
    // peak reaches a second reads in seconds; faster models stay in
    // milliseconds, where their numbers stay whole. The decision uses the
    // measured peak, not the rounded axis maximum: niceCeil(820) is 1000, and
    // taking that as "one second reached" would flip a sub-second chart to a
    // 0.00–1.00 second scale.
    const latencyUnit = pickLatencyUnit(peakLatency)

    // The success-rate axis is fixed at 0–100 instead of tracking the data:
    // a dynamic range would stretch a healthy 60–100% model across the whole
    // chart, making a 60% hour hug the baseline and read like a failure.
    const successTicks = [0, 50, 100]

    const xAt = (index: number) =>
      PAD_L + (PLOT_W * index) / (series.length - 1)
    const yLatency = (value: number) =>
      BASE_Y - (value / latencyMax) * PLOT_H
    const ySuccess = (value: number) => BASE_Y - (value / 100) * PLOT_H

    const band = PLOT_W / series.length
    // 24 hourly points leave ~14 units per band; keep bars readable with a
    // floor instead of letting them vanish.
    const barWidth = Math.max(4, Math.min(16, band * 0.6))
    const bars = series.map((point, index) => ({
      index,
      x: xAt(index) - barWidth / 2,
      y: yLatency(point.latency_ms),
      width: barWidth,
      height: Math.max(1, BASE_Y - yLatency(point.latency_ms)),
    }))

    const linePath = smoothLinePath(
      series.map((point, index) => ({
        x: xAt(index),
        y: ySuccess(point.success_rate),
      }))
    )

    // Label at most four hours; always keep the newest one when it clears the
    // previous label by a full step.
    const labelEvery = Math.max(1, Math.ceil(series.length / 4))
    const xLabels = series
      .map((point, index) => ({ index, label: formatHour(point.ts) }))
      .filter(
        (item, _, all) =>
          item.index % labelEvery === 0 ||
          (item.index === all.length - 1 &&
            item.index % labelEvery >= labelEvery - 1)
      )

    return {
      bars,
      linePath,
      xAt,
      ySuccess,
      latencyTicks,
      latencyUnit,
      successTicks,
      xLabels,
      band,
    }
  }, [series])

  if (!perf || !geometry) {
    return null
  }

  return (
    <MetricRows
      perf={perf}
      geometry={geometry}
      series={series}
      visible={props.visible ?? true}
      className={props.className}
    />
  )
})

/**
 * The animated half of the metrics card. Split out so the count-up hooks are
 * only mounted when there is data to show, and so hovering a chart hour
 * retargets the same hooks (count from the current value to the new one)
 * instead of remounting them.
 */
/**
 * Headline numbers (latency, hour, success rate). Re-renders only when the
 * count-up text or active point changes; the static chart SVG is not touched
 * by count-up animation frames.
 */
const MetricHeadline = memo(function MetricHeadline(props: {
  latencyText: string
  successText: string
  latencyWidth: string
  latencyUnit: LatencyUnit
  activePoint: ModelPerfTrendPoint | null
  t: (key: string) => string
}) {
  const {
    latencyText,
    successText,
    latencyWidth,
    latencyUnit,
    activePoint,
    t,
  } = props

  return (
    <div className='grid grid-cols-3 items-center gap-x-2 text-xs leading-4 tabular-nums'>
      <span className='flex min-w-0 items-baseline justify-start gap-1'>
        <span className='text-muted-foreground/55'>{t('Latency short')}</span>
        <span className='flex items-baseline gap-0.5'>
          <span className='text-foreground relative inline-block text-right font-mono font-semibold'>
            <span className='invisible'>{latencyWidth}</span>
            <span className='absolute inset-0 text-right'>{latencyText}</span>
          </span>
          <span className='text-muted-foreground/70 text-[10px]'>
            {latencyUnit}
          </span>
        </span>
      </span>
      <span className='flex min-w-0 items-baseline justify-center gap-1'>
        {activePoint ? (
          <span className='bg-foreground/10 text-foreground/80 rounded px-1 font-mono'>
            {formatHour(activePoint.ts)}
          </span>
        ) : (
          <span className='text-muted-foreground/40 font-mono'>—</span>
        )}
      </span>
      <span className='flex min-w-0 items-baseline justify-end gap-1'>
        <span className='text-muted-foreground/55'>{t('Success rate')}</span>
        <span className='flex items-baseline gap-0.5'>
          <span className='text-emerald-500 relative inline-block text-right font-mono font-semibold'>
            <span className='invisible'>100.0</span>
            <span className='absolute inset-0 text-right'>{successText}</span>
          </span>
          <span className='text-muted-foreground/70 text-[10px]'>%</span>
        </span>
      </span>
    </div>
  )
})

/**
 * Static chart SVG (grid lines, axis labels, bars, line path, dots, guide,
 * hit rects, x labels). Memoised so count-up animation frames in the headline
 * do not re-render the chart. Hover/pin handlers are passed as stable
 * callbacks from the parent.
 */
const MetricChart = memo(function MetricChart(props: {
  geometry: ChartGeometry
  series: ModelPerfTrendPoint[]
  active: number | null
  onHover: (index: number) => void
  onPin: (index: number) => void
  onMouseLeave: () => void
}) {
  const { geometry, series, active, onHover, onPin, onMouseLeave } = props

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className='mt-1.5 h-24 w-full'
      aria-hidden='true'
      onMouseLeave={onMouseLeave}
    >
      {/* Horizontal gridlines double as both axes' tick references */}
      {geometry.latencyTicks.map((tick) => {
        const y = BASE_Y - (tick / geometry.latencyTicks[2]) * PLOT_H
        return (
          <line
            key={`grid-${tick}`}
            x1={PAD_L}
            x2={CHART_W - PAD_R}
            y1={y}
            y2={y}
            className={GRID_COLOR}
            strokeOpacity={0.12}
            strokeWidth={1}
            vectorEffect='non-scaling-stroke'
          />
        )
      })}

      {/* Left axis: latency, one unit for the whole chart */}
      {geometry.latencyTicks.map((tick, index) => {
        const y = BASE_Y - (tick / geometry.latencyTicks[2]) * PLOT_H
        return (
          <text
            key={`lat-${tick}`}
            x={PAD_L - 6}
            y={y + 3}
            textAnchor='end'
            className='fill-muted-foreground/55'
            fontSize={9}
          >
            {index === geometry.latencyTicks.length - 1
              ? `${formatLatencyValue(tick, geometry.latencyUnit)}${geometry.latencyUnit}`
              : formatLatencyValue(tick, geometry.latencyUnit)}
          </text>
        )
      })}

      {/* Right axis: success rate (%) */}
      {geometry.successTicks.map((tick, index) => {
        const y =
          BASE_Y -
          ((tick - geometry.successTicks[0]) /
            (geometry.successTicks[2] - geometry.successTicks[0])) *
            PLOT_H
        return (
          <text
            key={`succ-${tick}`}
            x={CHART_W - PAD_R + 6}
            y={y + 3}
            textAnchor='start'
            className='fill-muted-foreground/55'
            fontSize={9}
          >
            {index === geometry.successTicks.length - 1 ? `${tick}%` : tick}
          </text>
        )
      })}

      {/* Latency bars; non-active bars dim while a point is active */}
      {geometry.bars.map((bar) => (
        <rect
          key={`bar-${series[bar.index].ts}`}
          className='card-chart-bar'
          x={bar.x}
          y={bar.y}
          width={bar.width}
          height={bar.height}
          rx={1.5}
          fill={LATENCY_COLOR}
          fillOpacity={active == null || active === bar.index ? 0.85 : 0.22}
          style={{
            animationDelay: `${bar.index * 18}ms`,
            transition: 'fill-opacity 140ms ease',
          }}
        />
      ))}

      {/* Success-rate line + points */}
      <path
        className='card-chart-line'
        d={geometry.linePath}
        pathLength={1}
        fill='none'
        stroke={SUCCESS_COLOR}
        strokeWidth={2}
        strokeLinecap='round'
        strokeLinejoin='round'
        vectorEffect='non-scaling-stroke'
      />
      {series.map((point, index) => (
        <circle
          key={`dot-${point.ts}`}
          className='card-chart-dot'
          cx={geometry.xAt(index)}
          cy={geometry.ySuccess(point.success_rate)}
          r={active === index ? 3.2 : 2}
          fill={SUCCESS_COLOR}
          stroke='white'
          strokeWidth={1}
          vectorEffect='non-scaling-stroke'
          style={{
            animationDelay: `${420 + index * 12}ms`,
            transition: 'r 140ms ease',
          }}
        />
      ))}

      {/* Active-hour guide */}
      {active != null && (
        <line
          x1={geometry.xAt(active)}
          x2={geometry.xAt(active)}
          y1={PAD_T}
          y2={BASE_Y}
          stroke='currentColor'
          className='fill-foreground'
          strokeOpacity={0.35}
          strokeWidth={1}
          vectorEffect='non-scaling-stroke'
          style={{ transition: 'stroke-opacity 140ms ease' }}
        />
      )}

      {/* X axis: hour labels */}
      {geometry.xLabels.map((item) => (
        <text
          key={`x-${item.index}`}
          x={geometry.xAt(item.index)}
          y={CHART_H - 3}
          textAnchor='middle'
          className='fill-muted-foreground/55'
          fontSize={9}
        >
          {item.label}
        </text>
      ))}

      {/* Hit areas: hover previews a hour, click pins it. Clicks must not
          reach the card, which opens the details drawer. */}
      {series.map((point, index) => (
        <rect
          key={`hit-${point.ts}`}
          x={geometry.xAt(index) - geometry.band / 2}
          y={0}
          width={geometry.band}
          height={CHART_H}
          fill='transparent'
          style={{ pointerEvents: 'all', cursor: 'pointer' }}
          onMouseEnter={() => onHover(index)}
          onClick={(event) => {
            event.stopPropagation()
            onPin(index)
          }}
        />
      ))}
    </svg>
  )
})

/**
 * The animated half of the metrics card. Split out so the count-up hooks are
 * only mounted when there is data to show, and so hovering a chart hour
 * retargets the same hooks (count from the current value to the new one)
 * instead of remounting them.
 */
function MetricRows(props: {
  perf: ModelPerfBadgeData
  geometry: ChartGeometry
  series: ModelPerfTrendPoint[]
  visible: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const { perf, geometry, series } = props
  const [hovered, setHovered] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)
  const active = pinned ?? hovered
  const activePoint = active != null ? series[active] : null

  // Stable callbacks so the memoised MetricChart does not re-render when its
  // handler props change identity on every render.
  const onHover = useCallback((index: number) => setHovered(index), [])
  const onPin = useCallback(
    (index: number) => setPinned((current) => (current === index ? null : index)),
    []
  )
  const onMouseLeave = useCallback(() => setHovered(null), [])

  // Both headline numbers count up when the card scrolls into view, and
  // retarget (count from the current value to the new one) when the hovered
  // chart hour changes. The slots are sized from the chart's own axis maxima,
  // never from the live value: latency reserves the widest y-axis tick and the
  // success rate always reserves "100.0", so the units and the neighbouring
  // labels never move mid-animation.
  const latencyText = useCountUpText(
    activePoint
      ? formatLatencyValue(activePoint.latency_ms, geometry.latencyUnit)
      : formatLatencyValue(perf.avg_latency_ms, geometry.latencyUnit),
    props.visible
  )
  const latencyWidth = formatLatencyValue(
    geometry.latencyTicks[2],
    geometry.latencyUnit
  )
  const successText = useCountUpText(
    activePoint
      ? activePoint.success_rate.toFixed(1)
      : perf.success_rate.toFixed(1),
    props.visible
  )
  return (
    <div className={cn('border-t pt-3', props.className)}>
      {/* Headline numbers: window averages, or the hovered/clicked hour.
          Latency hugs the left edge, the hour sits in the middle, and the
          success rate hugs the right edge, so the row reads left → centre →
          right no matter how wide each number is. */}
      <MetricHeadline
        latencyText={latencyText}
        successText={successText}
        latencyWidth={latencyWidth}
        latencyUnit={geometry.latencyUnit}
        activePoint={activePoint}
        t={t}
      />

      <MetricChart
        geometry={geometry}
        series={series}
        active={active}
        onHover={onHover}
        onPin={onPin}
        onMouseLeave={onMouseLeave}
      />
    </div>
  )
}
