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
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { PieChart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ChartContainer } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { formatShare } from '../lib/format'
import type { RankingPeriod, VendorRanking, VendorShareSeries } from '../types'
import { VendorLink } from './entity-links'

const PERIOD_DESCRIPTIONS: Record<RankingPeriod, string> = {
  today: 'Token share by model author across the last 24 hours',
  week: 'Token share by model author across the past few weeks',
  month: 'Token share by model author across the past month',
  year: 'Token share by model author across the past year',
  all: 'Token share by model author since launch',
}

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
  '#0ea5e9', '#22c55e', '#a855f7', '#f97316', '#14b8a6',
  '#eab308', '#ec4899', '#84cc16', '#6366f1', '#10b981',
  '#f43f5e', '#0891b2', '#94a3b8',
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

function sanitizeKey(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_')
}

const MAX_VENDORS_IN_LIST = 12

type MarketShareSectionProps = {
  history: VendorShareSeries
  rows: VendorRanking[]
  period: RankingPeriod
}

export function MarketShareSection(props: MarketShareSectionProps) {
  const { t } = useTranslation()

  const colourMap = useMemo(
    () => buildVendorColourMap(props.history.vendors.map((v) => v.name)),
    [props.history]
  )

  const { wideRows, vendors, chartConfig, keyToVendor } = useMemo(() => {
    const vendorList = props.history.vendors.map((v) => v.name)
    const keyToVendor = new Map<string, string>()
    vendorList.forEach((v) => keyToVendor.set(sanitizeKey(v), v))

    const cfg: ChartConfig = {}
    vendorList.forEach((v) => {
      const key = sanitizeKey(v)
      cfg[key] = { label: v, color: colourMap[v] ?? '#94a3b8' }
    })

    const map = new Map<string, Record<string, string | number>>()
    for (const p of props.history.points) {
      if (!map.has(p.label)) map.set(p.label, { label: p.label })
      const key = sanitizeKey(p.vendor)
      const existing = (map.get(p.label)![key] as number) ?? 0
      map.get(p.label)![key] = existing + p.share
    }
    const wideRows = Array.from(map.values())
    for (const row of wideRows) {
      for (const v of vendorList) {
        const key = sanitizeKey(v)
        if (!(key in row)) row[key] = 0
      }
    }

    return { wideRows, vendors: vendorList, chartConfig: cfg, keyToVendor }
  }, [props.history, colourMap])

  const visible = props.rows.slice(0, MAX_VENDORS_IN_LIST)
  const half = Math.ceil(visible.length / 2)
  const left = visible.slice(0, half)
  const right = visible.slice(half)

  return (
    <section className='bg-card overflow-hidden rounded-lg border'>
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
        <div className='h-60 sm:h-72'>
          {wideRows.length > 0 ? (
            <ChartContainer config={chartConfig} className='h-full w-full'>
              <BarChart data={wideRows} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray='3 3' className='stroke-border/40' vertical={false} />
                <XAxis
                  dataKey='label'
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval='preserveStartEnd'
                />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={38}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const items = payload
                      .map((p) => ({
                        vendor: keyToVendor.get(String(p.dataKey)) ?? String(p.dataKey),
                        share: Number(p.value) || 0,
                        color: p.color,
                      }))
                      .filter((p) => p.share > 0.001)
                      .sort((a, b) => b.share - a.share)
                    return (
                      <div className='border-border/50 bg-background grid min-w-40 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl'>
                        <div className='text-muted-foreground font-medium'>{label}</div>
                        {items.map((p) => (
                          <div key={p.vendor} className='flex items-center gap-2'>
                            <div className='h-2 w-2 shrink-0 rounded-sm' style={{ backgroundColor: p.color }} />
                            <div className='flex flex-1 justify-between gap-3'>
                              <span className='text-muted-foreground max-w-36 truncate'>{p.vendor}</span>
                              <span className='font-mono tabular-nums'>
                                {`${(p.share * 100).toFixed(1)}%`}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  }}
                />
                {vendors.map((vendor) => {
                  const key = sanitizeKey(vendor)
                  return (
                    <Bar
                      key={key}
                      dataKey={key}
                      stackId='a'
                      fill={`var(--color-${key})`}
                      isAnimationActive={false}
                    />
                  )
                })}
              </BarChart>
            </ChartContainer>
          ) : (
            <div className='text-muted-foreground/80 flex h-full items-center justify-center text-xs'>
              {t('No history data available')}
            </div>
          )}
        </div>
      </div>

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
            {right.length > 0 && <VendorList rows={right} colourMap={colourMap} />}
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
            style={{ backgroundColor: props.colourMap[vendor.vendor] ?? '#94a3b8' }}
          />
          <VendorLink
            vendor={vendor.vendor}
            className='text-foreground min-w-0 flex-1 truncate text-sm font-medium'
          >
            {vendor.vendor}
          </VendorLink>
          <div className='shrink-0 text-right'>
            <div className='text-foreground font-mono text-sm font-semibold tabular-nums'>
              {vendor.total_tokens.toLocaleString()}
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
