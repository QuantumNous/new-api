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
import { BarChart3, Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ChartContainer } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { formatTokens } from '../lib/format'
import type { ModelHistorySeries, ModelRanking, RankingPeriod } from '../types'
import { ModelLeaderboard } from './model-leaderboard'

const PERIOD_DESCRIPTIONS: Record<RankingPeriod, string> = {
  today: 'Hourly token usage by model across the last 24 hours',
  week: 'Weekly token usage by model across the past few weeks',
  month: 'Daily token usage by model across the past month',
  year: 'Weekly token usage by model across the past year',
  all: 'Token usage by model since launch',
}

const TOOLTIP_MAX_ROWS = 10

const MODEL_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

function sanitizeKey(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_')
}

type ModelsSectionProps = {
  history: ModelHistorySeries
  rows: ModelRanking[]
  period: RankingPeriod
}

export function ModelsSection(props: ModelsSectionProps) {
  const { t } = useTranslation()

  const totalTokens = useMemo(
    () => props.rows.reduce((s, r) => s + r.total_tokens, 0),
    [props.rows]
  )

  const { wideRows, models, chartConfig, keyToModel } = useMemo(() => {
    const modelList = props.history.models.map((m) => m.name)
    const keyToModel = new Map<string, string>()
    modelList.forEach((m) => keyToModel.set(sanitizeKey(m), m))

    const cfg: ChartConfig = {}
    modelList.forEach((m, i) => {
      const key = sanitizeKey(m)
      cfg[key] = {
        label: m,
        color: MODEL_COLORS[i % MODEL_COLORS.length],
      }
    })

    // pivot tidy → wide
    const map = new Map<string, Record<string, string | number>>()
    for (const p of props.history.points) {
      if (!map.has(p.label)) map.set(p.label, { label: p.label })
      const key = sanitizeKey(p.model)
      const existing = (map.get(p.label)![key] as number) ?? 0
      map.get(p.label)![key] = existing + p.tokens
    }
    const wideRows = Array.from(map.values())
    // fill zeros for missing models
    for (const row of wideRows) {
      for (const m of modelList) {
        const key = sanitizeKey(m)
        if (!(key in row)) row[key] = 0
      }
    }

    return { wideRows, models: modelList, chartConfig: cfg, keyToModel }
  }, [props.history])

  return (
    <section className='bg-card overflow-hidden rounded-lg border'>
      <header className='flex items-start justify-between gap-4 px-5 py-4'>
        <div className='min-w-0 flex-1'>
          <h2 className='text-foreground inline-flex items-center gap-2 text-base font-semibold'>
            <BarChart3 className='text-primary size-4' />
            {t('Top Models')}
          </h2>
          <p className='text-muted-foreground mt-1 text-sm'>
            {t(PERIOD_DESCRIPTIONS[props.period])}
          </p>
        </div>
        <div className='shrink-0 text-right'>
          <div className='text-foreground font-mono text-2xl font-semibold tabular-nums'>
            {formatTokens(totalTokens)}
          </div>
          <div className='text-muted-foreground/80 text-[10px] font-medium tracking-widest uppercase'>
            {t('tokens')}
          </div>
        </div>
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
                  tickFormatter={formatTokens}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const items = payload
                      .map((p) => ({
                        model: keyToModel.get(String(p.dataKey)) ?? String(p.dataKey),
                        value: Number(p.value) || 0,
                        color: p.color,
                      }))
                      .filter((p) => p.value > 0)
                      .sort((a, b) => b.value - a.value)
                    const total = items.reduce((s, p) => s + p.value, 0)
                    const visible = items.slice(0, TOOLTIP_MAX_ROWS)
                    const overflow = items.slice(TOOLTIP_MAX_ROWS)
                    return (
                      <div className='border-border/50 bg-background grid min-w-40 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl'>
                        <div className='text-muted-foreground font-medium'>{label}</div>
                        <div className='flex justify-between gap-4 font-medium'>
                          <span>{t('Total:')}</span>
                          <span className='font-mono tabular-nums'>{formatTokens(total)}</span>
                        </div>
                        {visible.map((p) => (
                          <div key={p.model} className='flex items-center gap-2'>
                            <div className='h-2 w-2 shrink-0 rounded-sm' style={{ backgroundColor: p.color }} />
                            <div className='flex flex-1 justify-between gap-3'>
                              <span className='text-muted-foreground max-w-36 truncate'>{p.model}</span>
                              <span className='font-mono tabular-nums'>{formatTokens(p.value)}</span>
                            </div>
                          </div>
                        ))}
                        {overflow.length > 0 && (
                          <div className='text-muted-foreground flex justify-between gap-3'>
                            <span>{t('+{{count}} more', { count: overflow.length })}</span>
                            <span className='font-mono tabular-nums'>
                              {formatTokens(overflow.reduce((s, p) => s + p.value, 0))}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  }}
                />
                {models.map((model) => {
                  const key = sanitizeKey(model)
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
          <h3 className='text-foreground inline-flex items-center gap-2 text-sm font-semibold'>
            <Trophy className='size-3.5 text-amber-500' />
            {t('LLM Leaderboard')}
          </h3>
          <p className='text-muted-foreground/80 mt-0.5 text-xs'>
            {t('Compare the most popular models on the platform')}
          </p>
        </header>
        {props.rows.length === 0 ? (
          <div className='text-muted-foreground/80 px-5 py-8 text-center text-sm'>
            {t('No models match the selected filters')}
          </div>
        ) : (
          <div className='px-5 pt-1 pb-4'>
            <ModelLeaderboard rows={props.rows} />
          </div>
        )}
      </div>
    </section>
  )
}
