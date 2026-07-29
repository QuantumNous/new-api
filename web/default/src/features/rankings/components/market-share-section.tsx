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
import { PieChart } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart'

import { formatShare, formatTokens } from '../lib/format'
import type { RankingPeriod, VendorRanking, VendorShareSeries } from '../types'
import { VendorLink } from './entity-links'

const PERIOD_DESCRIPTIONS: Record<RankingPeriod, string> = {
  today: 'Token share by model author across the last 24 hours',
  week: 'Token share by model author across the past few weeks',
  month: 'Token share by model author across the past month',
  year: 'Token share by model author across the past year',
}

/** Stable colour palette for vendors, used in both the share chart and the
 * legend dots. Falls back to a neutral palette for unknown vendors so that
 * future additions still render. */
const VENDOR_COLOURS: Record<string, string> = {
  OpenAI: '#10a37f',
  Anthropic: '#d97757',
  Google: '#4285f4',
  DeepSeek: '#7c5cff',
  Alibaba: '#ff9900',
  xAI: '#1f2937',
  Meta: '#1877f2',
  Moonshot: '#ec4899',
  Zhipu: '#06b6d4',
  Mistral: '#ff7000',
  ByteDance: '#3b82f6',
  Tencent: '#22c55e',
  MiniMax: '#a855f7',
  Cohere: '#fb923c',
  Baidu: '#ef4444',
  Others: '#94a3b8',
}

const FALLBACK_PALETTE = [
  '#0ea5e9',
  '#22c55e',
  '#a855f7',
  '#f97316',
  '#14b8a6',
  '#eab308',
  '#ec4899',
  '#84cc16',
  '#6366f1',
  '#10b981',
  '#f43f5e',
  '#0891b2',
  '#94a3b8',
]

function buildVendorColourMap(names: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  let fallbackIdx = 0
  for (const name of names) {
    if (VENDOR_COLOURS[name]) {
      result[name] = VENDOR_COLOURS[name]
    } else {
      result[name] = FALLBACK_PALETTE[fallbackIdx % FALLBACK_PALETTE.length]
      fallbackIdx += 1
    }
  }
  return result
}

const MAX_VENDORS_IN_LIST = 12

/** Minimum share for a vendor to show up in the shared tooltip. */
const TOOLTIP_MIN_SHARE = 0.001

/** Token counts per vendor, carried alongside the shares for tooltip use. */
const TOKENS_FIELD = '__tokens'

type ShareRow = Record<string, number | string | Record<string, number>> & {
  label: string
  [TOKENS_FIELD]: Record<string, number>
}

type MarketShareSectionProps = {
  history: VendorShareSeries
  rows: VendorRanking[]
  period: RankingPeriod
}

function VendorShareTooltip(props: Partial<TooltipContentProps>) {
  if (!props.active || !props.payload?.length) return null

  const tokensByVendor = (props.payload[0]?.payload as ShareRow | undefined)?.[
    TOKENS_FIELD
  ]

  const entries = props.payload
    .map((item) => ({
      name: String(item.name ?? ''),
      color: item.color,
      share: Number(item.value) || 0,
    }))
    .filter((item) => item.share > TOOLTIP_MIN_SHARE)
    .sort((a, b) => b.share - a.share)

  if (entries.length === 0) return null

  return (
    <div className='border-border/50 bg-background grid min-w-40 items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl'>
      {props.label != null && (
        <div className='font-medium'>{String(props.label)}</div>
      )}
      <div className='grid gap-1'>
        {entries.map((item) => (
          <div
            key={item.name}
            className='flex items-center justify-between gap-4'
          >
            <span className='flex min-w-0 items-center gap-1.5'>
              <span
                aria-hidden
                className='size-2.5 shrink-0 rounded-[2px]'
                style={{ backgroundColor: item.color }}
              />
              <span className='text-muted-foreground truncate'>
                {item.name}
              </span>
            </span>
            <span className='text-foreground font-mono tabular-nums'>
              {`${(item.share * 100).toFixed(1)}%`}
              {tokensByVendor?.[item.name] != null &&
                ` · ${formatTokens(tokensByVendor[item.name])}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Combined "Market Share" card: a 100%-stacked bar chart showing each
 * vendor's slice of total token volume, paired below with a two-column
 * vendor list.
 */
export function MarketShareSection(props: MarketShareSectionProps) {
  const { t } = useTranslation()

  const colourMap = useMemo(
    () => buildVendorColourMap(props.history.vendors.map((v) => v.name)),
    [props.history]
  )

  const chart = useMemo(() => {
    const vendors = props.history.vendors.map((vendor) => vendor.name)
    const rowsByTs = new Map<string, ShareRow>()

    for (const point of [...props.history.points].sort((a, b) =>
      a.ts.localeCompare(b.ts)
    )) {
      let row = rowsByTs.get(point.ts)
      if (!row) {
        row = { label: point.label, [TOKENS_FIELD]: {} }
        rowsByTs.set(point.ts, row)
      }
      row[point.vendor] = point.share
      row[TOKENS_FIELD][point.vendor] = point.tokens
    }

    const config: ChartConfig = {}
    for (const vendor of vendors) {
      config[vendor] = { label: vendor, color: colourMap[vendor] ?? '#94a3b8' }
    }

    return { rows: [...rowsByTs.values()], vendors, config }
  }, [colourMap, props.history])

  const hasChartData = chart.rows.length > 0 && chart.vendors.length > 0

  const visible = props.rows.slice(0, MAX_VENDORS_IN_LIST)
  const half = Math.ceil(visible.length / 2)
  const left = visible.slice(0, half)
  const right = visible.slice(half)

  return (
    <section className='bg-card overflow-hidden rounded-lg border'>
      {/* Chart block ----------------------------------------------------- */}
      <header className='px-5 py-4'>
        <h2 className='text-foreground inline-flex items-center gap-2 text-base font-semibold'>
          <PieChart className='text-primary size-4' />
          {t('Market Share')}
        </h2>
        <p className='text-muted-foreground mt-1 text-sm'>
          {t(PERIOD_DESCRIPTIONS[props.period])}
        </p>
      </header>

      <div className='px-5 pb-5'>
        <div className='ring-foreground/10 overflow-hidden rounded-xl p-3 ring-1'>
          {hasChartData ? (
            <ChartContainer
              config={chart.config}
              className='aspect-auto h-60 w-full sm:h-72'
            >
              <BarChart
                data={chart.rows}
                margin={{ left: 4, right: 8, top: 8 }}
                barCategoryGap='12%'
              >
                <CartesianGrid vertical={false} strokeDasharray='3 3' />
                <XAxis
                  dataKey='label'
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  domain={[0, 1]}
                  tickFormatter={(value) =>
                    `${Math.round(Number(value) * 100)}%`
                  }
                />
                <ChartTooltip
                  cursor={{ fillOpacity: 0.12 }}
                  content={<VendorShareTooltip />}
                />
                {chart.vendors.map((vendor) => (
                  <Bar
                    key={vendor}
                    dataKey={vendor}
                    name={vendor}
                    stackId='share'
                    fill={colourMap[vendor] ?? '#94a3b8'}
                    isAnimationActive
                  />
                ))}
              </BarChart>
            </ChartContainer>
          ) : (
            <div className='text-muted-foreground/80 flex h-60 items-center justify-center text-xs sm:h-72'>
              {t('No history data available')}
            </div>
          )}
        </div>
      </div>

      {/* Vendor list block ----------------------------------------------- */}
      <div className='border-t'>
        <header className='px-5 pt-4 pb-2'>
          <h3 className='text-foreground text-sm font-semibold'>
            {t('By model author')}
          </h3>
          <p className='text-muted-foreground/80 mt-0.5 text-xs'>
            {t('Vendors ranked by aggregated token volume')}
          </p>
        </header>
        {visible.length === 0 ? (
          <div className='text-muted-foreground/80 px-5 py-8 text-center text-sm'>
            {t('No vendor data available')}
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-x-8 px-5 pt-1 pb-4 md:grid-cols-2'>
            <VendorList rows={left} colourMap={colourMap} />
            {right.length > 0 && (
              <VendorList rows={right} colourMap={colourMap} />
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function VendorList(props: {
  rows: VendorRanking[]
  colourMap: Record<string, string>
}) {
  return (
    <ul>
      {props.rows.map((vendor) => (
        <li key={vendor.vendor} className='flex items-center gap-3 py-2.5'>
          <span className='text-muted-foreground/80 w-6 shrink-0 text-right font-mono text-xs tabular-nums'>
            {vendor.rank}.
          </span>
          <span
            aria-hidden
            className='size-2.5 shrink-0 rounded-full'
            style={{
              backgroundColor: props.colourMap[vendor.vendor] ?? '#94a3b8',
            }}
          />
          <VendorLink
            vendor={vendor.vendor}
            className='text-foreground min-w-0 flex-1 truncate text-sm font-medium'
          >
            {vendor.vendor}
          </VendorLink>
          <div className='shrink-0 text-right'>
            <div className='text-foreground font-mono text-sm font-semibold tabular-nums'>
              {formatTokens(vendor.total_tokens)}
            </div>
            <div className='text-muted-foreground/80 font-mono text-[11px] tabular-nums'>
              {formatShare(vendor.share)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
