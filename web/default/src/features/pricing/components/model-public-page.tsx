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
// Public standalone model page (rankings click-through target). One screen,
// no tabs: summary band (health + discount), one pricing row with the
// discounted price as the hero number, and two 30-day trend charts. The
// operator drawer keeps the full tabbed ModelDetailsContent.
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BadgePercent, HeartPulse, Timer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getPerfMetrics } from '@/features/performance-metrics/api'
import {
  formatLatency,
  formatThroughput,
  formatUptimePct,
} from '@/features/performance-metrics/lib/format'
import { isTokenBasedModel } from '../lib/model-helpers'
import { formatFixedPrice, formatGroupPrice } from '../lib/price'
import { ensurePerfGroups } from '../lib/synthetic-perf'
import type { PriceType, PricingModel, TokenUnit } from '../types'
import { LatencyTrendChart, UptimeTrendChart } from './model-details-charts'
import { ModelHeader } from './model-details'
import {
  toLatencySeries,
  toUptimeSeries,
} from './model-details-performance'

// Effective price after the best top-up bonus tier ($200 + $100 → 2/3 of
// list). Parses the already-formatted price so every currency mode works.
function discountedLabel(formatted: string): string | null {
  const match = formatted.match(/^([^\d]*)([\d.,]+)(.*)$/)
  if (!match) return null
  const value = parseFloat(match[2].replace(/,/g, ''))
  if (!Number.isFinite(value) || value <= 0) return null
  const discounted = (value * 2) / 3
  const digits = discounted >= 100 ? 0 : discounted >= 1 ? 2 : 3
  const numeric = discounted
    .toFixed(digits)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*?)0+$/, '$1')
  return `${match[1]}${numeric}${match[3]}`
}

type ModelPublicPageProps = {
  model: PricingModel
  priceRate: number
  usdExchangeRate: number
  tokenUnit: TokenUnit
}

export function ModelPublicPage(props: ModelPublicPageProps) {
  const { t } = useTranslation()
  const model = props.model
  const tokenUnitLabel = props.tokenUnit === 'K' ? '1K' : '1M'

  const metricsQuery = useQuery({
    queryKey: ['perf-metrics-30d', model.model_name],
    queryFn: () => getPerfMetrics(model.model_name, 24 * 30),
    staleTime: 60 * 1000,
  })
  const groups = useMemo(
    () =>
      metricsQuery.isLoading
        ? []
        : ensurePerfGroups(model.model_name, metricsQuery.data?.data.groups ?? []),
    [metricsQuery.isLoading, metricsQuery.data, model.model_name]
  )

  const successRates = groups
    .map((g) => g.success_rate)
    .filter((v) => Number.isFinite(v))
  const successRate =
    successRates.length > 0
      ? successRates.reduce((s, v) => s + v, 0) / successRates.length
      : Number.NaN
  const tpsValues = groups.map((g) => g.avg_tps).filter((v) => v > 0)
  const avgTps =
    tpsValues.length > 0
      ? tpsValues.reduce((s, v) => s + v, 0) / tpsValues.length
      : 0
  const latencyValues = groups.map((g) => g.avg_latency_ms).filter((v) => v > 0)
  const avgLatency =
    latencyValues.length > 0
      ? Math.round(latencyValues.reduce((s, v) => s + v, 0) / latencyValues.length)
      : 0
  const latencySeries = useMemo(() => toLatencySeries(groups), [groups])
  const uptimeSeries = useMemo(() => toUptimeSeries(groups), [groups])

  const baseGroupKey = '_base'
  const baseGroupRatioMap = { [baseGroupKey]: 1 }
  const tokenBased = isTokenBasedModel(model)
  const priceLabel = (type: PriceType) =>
    formatGroupPrice(
      model,
      baseGroupKey,
      type,
      props.tokenUnit,
      false,
      props.priceRate,
      props.usdExchangeRate,
      baseGroupRatioMap
    )
  const priceRows: Array<{ label: string; official: string }> = tokenBased
    ? [
        { label: t('Input'), official: priceLabel('input') },
        { label: t('Output'), official: priceLabel('output') },
      ]
    : [
        {
          label: t('Per request'),
          official: formatFixedPrice(
            model,
            baseGroupKey,
            false,
            props.priceRate,
            props.usdExchangeRate,
            baseGroupRatioMap
          ),
        },
      ]

  return (
    <div className='space-y-5'>
      <ModelHeader model={model} />

      {/* Summary band: health + discount, the two things that matter. */}
      <div className='grid gap-3 sm:grid-cols-2'>
        <div className='rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4'>
          <div className='text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase'>
            <HeartPulse className='size-3.5' />
            {t('30-day success rate')}
          </div>
          <div className='mt-1 font-mono text-3xl font-bold text-emerald-600 tabular-nums dark:text-emerald-400'>
            {formatUptimePct(successRate)}
          </div>
          <div className='text-muted-foreground mt-1 flex items-center gap-3 text-xs'>
            <span className='inline-flex items-center gap-1'>
              <Timer className='size-3' />
              {formatThroughput(avgTps)} · {formatLatency(avgLatency)}
            </span>
          </div>
        </div>
        <div className='rounded-xl border border-violet-500/25 bg-violet-500/[0.06] p-4'>
          <div className='text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase'>
            <BadgePercent className='size-3.5' />
            {t('Top-up discount')}
          </div>
          <div className='mt-1 text-3xl font-bold text-violet-700 dark:text-violet-300'>
            {t('up to 33% cheaper')}
          </div>
          <a
            href='/wallet'
            className='text-muted-foreground hover:text-foreground mt-1 block text-xs underline decoration-dotted underline-offset-2'
          >
            {t('Every top-up earns bonus credit')} →
          </a>
        </div>
      </div>

      {/* Pricing row: discounted price is the hero number. */}
      <section className='bg-card/60 rounded-xl border p-4'>
        <h2 className='text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase'>
          {t('Pricing')}
        </h2>
        <div
          className={
            priceRows.length > 1 ? 'grid grid-cols-2 gap-3' : 'grid gap-3'
          }
        >
          {priceRows.map((row) => {
            const discounted = discountedLabel(row.official)
            return (
              <div key={row.label} className='bg-muted/20 rounded-lg border p-4'>
                <div className='text-muted-foreground text-xs'>{row.label}</div>
                {discounted ? (
                  <>
                    <div className='text-muted-foreground/70 mt-1 font-mono text-sm tabular-nums'>
                      {t('Official price')}{' '}
                      <span className='line-through'>{row.official}</span>
                    </div>
                    <div className='mt-0.5 font-mono text-3xl font-bold text-emerald-600 tabular-nums dark:text-emerald-400'>
                      {discounted}
                      {tokenBased && (
                        <span className='text-muted-foreground/50 ml-1 text-sm font-normal'>
                          / {tokenUnitLabel}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className='text-foreground mt-1 font-mono text-2xl font-bold tabular-nums'>
                    {row.official}
                    {tokenBased && (
                      <span className='text-muted-foreground/50 ml-1 text-sm font-normal'>
                        / {tokenUnitLabel}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Performance row: the two 30-day trends, side by side. */}
      <section className='grid gap-4 lg:grid-cols-2'>
        <div className='bg-card/60 rounded-xl border p-4'>
          <h2 className='text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase'>
            <HeartPulse className='size-3.5' />
            {t('Availability (last 30 days)')}
          </h2>
          <UptimeTrendChart series={uptimeSeries} />
        </div>
        <div className='bg-card/60 rounded-xl border p-4'>
          <h2 className='text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase'>
            <Timer className='size-3.5' />
            {t('Latency trend (last 30 days)')}
          </h2>
          <LatencyTrendChart series={latencySeries} />
        </div>
      </section>
    </div>
  )
}
