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
import { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type {
  GenerationDebugCacheBoundary,
  GenerationDebugPromptUnit,
} from './types'
import {
  cacheStatusLabel,
  confidenceLabel,
  formatGenerationTokens,
  roleLabel,
} from './utils'

interface TokenMessageChartProps {
  units: GenerationDebugPromptUnit[]
  cacheBoundary?: GenerationDebugCacheBoundary
}

interface ChartUnit {
  chartIndex: number
  tokens: number
  cachedTokens: number
  uncachedTokens: number
  unit: GenerationDebugPromptUnit
}

function cacheColor(status: string): string {
  switch (status) {
    case 'hit':
      return 'var(--success)'
    case 'partial':
      return 'var(--warning)'
    case 'miss':
      return 'var(--muted-foreground)'
    case 'write':
      return 'var(--chart-1)'
    default:
      return 'var(--chart-2)'
  }
}

function TokenTooltip(props: {
  active?: boolean
  payload?: Array<{ payload: ChartUnit }>
}) {
  const { t } = useTranslation()
  const unit = props.payload?.[0]?.payload.unit
  if (!props.active || !unit) return null

  return (
    <div className='bg-background min-w-56 rounded-md border p-2 text-xs shadow-sm'>
      <div className='mb-1 font-mono text-[11px]'>{unit.path}</div>
      <div className='grid grid-cols-[7rem_minmax(0,1fr)] gap-x-2 gap-y-1'>
        <span className='text-muted-foreground'>{t('Role')}</span>
        <span>{roleLabel(unit.role, t)}</span>
        <span className='text-muted-foreground'>{t('Estimated tokens')}</span>
        <span>{unit.estimated_tokens.toLocaleString()}</span>
        <span className='text-muted-foreground'>{t('Cumulative range')}</span>
        <span>
          {unit.cumulative_start.toLocaleString()} -{' '}
          {unit.cumulative_end.toLocaleString()}
        </span>
        <span className='text-muted-foreground'>{t('Cache status')}</span>
        <span>{cacheStatusLabel(unit.cache_status, t)}</span>
        <span className='text-muted-foreground'>{t('Cache overlap')}</span>
        <span>{unit.cache_overlap_tokens.toLocaleString()}</span>
        <span className='text-muted-foreground'>
          {t('Field cache hit rate')}
        </span>
        <span>
          {(unit.estimated_tokens > 0
            ? unit.cache_overlap_tokens / unit.estimated_tokens
            : 0
          ).toLocaleString(undefined, {
            style: 'percent',
            maximumFractionDigits: 1,
          })}
        </span>
        <span className='text-muted-foreground'>{t('Confidence')}</span>
        <span>{confidenceLabel(unit.confidence, t)}</span>
      </div>
    </div>
  )
}

export function TokenMessageChart(props: TokenMessageChartProps) {
  const { t } = useTranslation()
  const patternId = useId().replaceAll(':', '')
  const data = useMemo(
    () =>
      props.units.map((unit) => ({
        chartIndex: unit.index + 1,
        tokens: unit.estimated_tokens,
        cachedTokens: Math.min(
          unit.estimated_tokens,
          Math.max(0, unit.cache_overlap_tokens)
        ),
        uncachedTokens: Math.max(
          0,
          unit.estimated_tokens - unit.cache_overlap_tokens
        ),
        unit,
      })),
    [props.units]
  )

  if (data.length === 0) return null

  return (
    <div className='flex min-w-0 flex-col gap-2 rounded-md border p-2.5'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <span className='text-xs font-semibold'>
          {t('Tokens per prompt field')}
        </span>
        <span className='text-muted-foreground text-[11px]'>
          {t('Field attribution is inferred')}
        </span>
      </div>
      <div className='h-28 min-w-0'>
        <ResponsiveContainer width='100%' height='100%'>
          <BarChart
            data={data}
            margin={{ top: 4, right: 2, bottom: 0, left: 2 }}
          >
            <defs>
              <pattern
                id={patternId}
                patternUnits='userSpaceOnUse'
                width='6'
                height='6'
                patternTransform='rotate(45)'
              >
                <rect
                  width='6'
                  height='6'
                  fill='var(--warning)'
                  opacity='0.35'
                />
                <rect
                  width='2'
                  height='6'
                  fill='var(--warning)'
                  opacity='0.9'
                />
              </pattern>
            </defs>
            <XAxis dataKey='chartIndex' hide />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.45 }}
              content={<TokenTooltip />}
              contentStyle={{
                borderRadius: '8px',
                borderColor: 'var(--border)',
                backgroundColor: 'var(--background)',
                fontSize: '12px',
              }}
            />
            {props.cacheBoundary &&
              props.cacheBoundary.break_unit_index >= 0 && (
                <ReferenceLine
                  x={props.cacheBoundary.break_unit_index + 1}
                  stroke='var(--destructive)'
                  strokeDasharray='3 3'
                />
              )}
            <Bar
              dataKey='cachedTokens'
              stackId='tokens'
              minPointSize={0}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell
                  key={`cached-${entry.unit.index}-${entry.unit.path}`}
                  fill={
                    entry.unit.cache_status === 'partial'
                      ? `url(#${patternId})`
                      : cacheColor('hit')
                  }
                  fillOpacity={0.9}
                />
              ))}
            </Bar>
            <Bar
              dataKey='uncachedTokens'
              stackId='tokens'
              radius={[2, 2, 0, 0]}
              minPointSize={2}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell
                  key={`uncached-${entry.unit.index}-${entry.unit.path}`}
                  fill={cacheColor(
                    entry.unit.cache_status === 'partial'
                      ? 'partial'
                      : entry.unit.cache_status
                  )}
                  fillOpacity={entry.unit.cache_status === 'miss' ? 0.45 : 0.9}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className='text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-[11px]'>
        {(['hit', 'partial', 'miss', 'unknown'] as const).map((status) => (
          <span key={status} className='flex items-center gap-1'>
            <span
              className='size-2 rounded-full'
              style={{ backgroundColor: cacheColor(status) }}
              aria-hidden='true'
            />
            {cacheStatusLabel(status, t)}
          </span>
        ))}
        {props.cacheBoundary?.break_unit_path && (
          <span>
            {`${t('Breakpoint')}: ${props.cacheBoundary.break_unit_path} · ${t('offset')} ${formatGenerationTokens(props.cacheBoundary.break_offset_tokens)} ${t('estimated tokens')}`}
          </span>
        )}
      </div>
    </div>
  )
}
