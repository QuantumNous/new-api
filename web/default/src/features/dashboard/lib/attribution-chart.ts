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
import type { TFunction } from 'i18next'
import { formatLogQuota } from '@/lib/format'
import type { AttributionTrend } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VChartSpec = Record<string, any>

export const ATTRIBUTION_SERIES_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#64748b',
]

function formatBucketLabel(bucketSeconds: number): string {
  const date = new Date(bucketSeconds * 1000)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

/**
 * Build a stacked-by-day VChart area spec for the cost-attribution trend.
 * Mirrors the dashboard user-trend chart conventions (xField=Time,
 * seriesField=Name, value formatted via formatLogQuota).
 */
export function buildAttributionTrendSpec(
  trend: AttributionTrend,
  t: TFunction
): VChartSpec {
  const values: Array<{ Time: string; Name: string; rawQuota: number }> = []
  trend.buckets.forEach((bucket, index) => {
    const time = formatBucketLabel(bucket)
    trend.series.forEach((series) => {
      values.push({
        Time: time,
        Name: series.label || series.key || t('(empty)'),
        rawQuota: series.points[index] || 0,
      })
    })
  })

  return {
    type: 'area',
    data: [{ id: 'attributionTrend', values }],
    xField: 'Time',
    yField: 'rawQuota',
    seriesField: 'Name',
    stack: false,
    legends: { visible: true, selectMode: 'multiple' },
    color: { type: 'ordinal', range: ATTRIBUTION_SERIES_COLORS },
    point: { visible: false },
    axes: [
      { orient: 'bottom', type: 'band' },
      {
        orient: 'left',
        type: 'linear',
        label: {
          formatMethod: (value: number) => formatLogQuota(Number(value) || 0),
        },
      },
    ],
    tooltip: {
      mark: {
        content: [
          {
            key: (datum: Record<string, unknown>) => datum?.Name,
            value: (datum: Record<string, unknown>) =>
              formatLogQuota(Number(datum?.rawQuota) || 0),
          },
        ],
      },
      dimension: {
        content: [
          {
            key: (datum: Record<string, unknown>) => datum?.Name,
            value: (datum: Record<string, unknown>) =>
              formatLogQuota(Number(datum?.rawQuota) || 0),
          },
        ],
      },
    },
    background: { fill: 'transparent' },
  }
}
