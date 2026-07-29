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
import { MAX_CHART_TREND_POINTS } from '@/features/dashboard/constants'
import type {
  DashboardSeriesChart,
  QuotaDataItem,
  ProcessedChartData,
  ProcessedUserChartData,
} from '@/features/dashboard/types'
import { getCurrentIntlLocale } from '@/i18n/languages'
import { getCurrencyDisplay } from '@/lib/currency'
import { formatChartTime, type TimeGranularity } from '@/lib/time'

import { getDashboardChartColors, USER_CHART_COLORS } from './chart-palette'

type TFunction = (key: string) => string
type LongRow = Record<string, string | number>

const CHART_TIME_KEY = 'Time'
const SERIES_NAME_KEY = 'Series'
const SERIES_VALUE_KEY = 'Value'

/** Key format shared with `DashboardSeriesChart.rawByKey` consumers. */
function rawValueKey(xValue: string, seriesKey: string): string {
  return `${xValue}::${seriesKey}`
}

function renderQuotaCompat(rawQuota: number, digits = 4): string {
  const { config, meta } = getCurrencyDisplay()
  if (meta.kind === 'tokens') {
    return rawQuota.toLocaleString(getCurrentIntlLocale())
  }
  const usd = rawQuota / config.quotaPerUnit
  const rate = 'exchangeRate' in meta ? meta.exchangeRate : 1
  const symbol = 'symbol' in meta ? meta.symbol : '$'
  const value = usd * rate
  const fixed = value.toFixed(digits)
  if (Number.parseFloat(fixed) === 0 && rawQuota > 0 && value > 0) {
    return symbol + Math.pow(10, -digits).toFixed(digits)
  }
  return symbol + fixed
}

function getChartBucketTimestamp(
  timestamp: number,
  granularity: TimeGranularity
): number {
  if (granularity === 'hour') {
    return Math.floor(timestamp / 3600) * 3600
  }
  const date = new Date(timestamp * 1000)
  if (granularity === 'day') {
    date.setHours(0, 0, 0, 0)
  } else if (granularity === 'week') {
    date.setHours(0, 0, 0, 0)
    const daysSinceMonday = (date.getDay() + 6) % 7
    date.setDate(date.getDate() - daysSinceMonday)
  }
  return Math.floor(date.getTime() / 1000)
}

/**
 * Turns long rows (one row per x/series pair) into the wide rows Recharts
 * expects (one row per x value, one numeric field per series key). Missing
 * combinations are filled with 0 so stacks and areas stay continuous.
 */
export function pivotSeries(
  longRows: LongRow[],
  xKey: string,
  seriesKey: string,
  valueKey: string
): { rows: LongRow[]; seriesKeys: string[] } {
  const rowsByX = new Map<string, LongRow>()
  const seriesKeys: string[] = []

  for (const longRow of longRows) {
    const xValue = String(longRow[xKey] ?? '')
    const series = String(longRow[seriesKey] ?? '')
    const value = Number(longRow[valueKey]) || 0

    let row = rowsByX.get(xValue)
    if (!row) {
      row = { [xKey]: xValue }
      rowsByX.set(xValue, row)
    }
    row[series] = (Number(row[series]) || 0) + value

    if (!seriesKeys.includes(series)) seriesKeys.push(series)
  }

  const rows = [...rowsByX.values()]
  for (const row of rows) {
    for (const series of seriesKeys) {
      if (row[series] === undefined) row[series] = 0
    }
  }

  return { rows, seriesKeys }
}

/** Keeps the aggregated "Other" bucket last so legends read top-down. */
function orderSeriesKeys(seriesKeys: string[], otherLabel: string): string[] {
  const named = seriesKeys.filter((key) => key !== otherLabel).sort()
  return seriesKeys.includes(otherLabel) ? [...named, otherLabel] : named
}

function emptySeriesChart(
  title: string,
  valueKind: 'quota' | 'count',
  stacked = false
): DashboardSeriesChart {
  return {
    rows: [],
    xKey: CHART_TIME_KEY,
    seriesKeys: [],
    rawByKey: {},
    valueKind,
    stacked,
    title,
  }
}

/**
 * Process and aggregate chart data
 */
export function processChartData(
  data: QuotaDataItem[],
  timeGranularity: TimeGranularity = 'day',
  t?: TFunction
): ProcessedChartData {
  const tt: TFunction = t ?? ((x) => x)
  const otherLabel = tt('Other')

  const formatInt = (value: number) =>
    Intl.NumberFormat(getCurrentIntlLocale(), {
      maximumFractionDigits: 0,
    }).format(value)
  const formatQuotaTotal = (value: number) => renderQuotaCompat(value, 2)

  if (!data || data.length === 0) {
    return {
      pie: { rows: [], title: tt('Call Count Distribution') },
      stackedQuota: emptySeriesChart(tt('Quota Distribution'), 'quota', true),
      areaQuota: emptySeriesChart(tt('Quota Distribution'), 'quota'),
      trendCount: emptySeriesChart(tt('Call Trend'), 'count'),
      rankCount: {
        rows: [],
        valueKind: 'count',
        layout: 'horizontal',
        title: tt('Call Count Ranking'),
        subtext: tt('No data available'),
      },
      totalQuotaDisplay: formatQuotaTotal(0),
      totalCountDisplay: formatInt(0),
    }
  }

  const { config, meta } = getCurrencyDisplay()
  const quotaPerUnit = config.quotaPerUnit
  // Quota series are plotted in the same unit the tooltip/label formatter
  // renders, so axes and tooltips cannot disagree.
  const toDisplayQuota = (rawQuota: number) => {
    if (!rawQuota) return 0
    if (meta.kind === 'tokens') return rawQuota
    return Number((rawQuota / quotaPerUnit).toFixed(4))
  }

  // Aggregate all metrics by time and model
  const timeModelMap = new Map<
    number,
    Map<string, { quota: number; count: number; tokens: number }>
  >()
  const modelTotalsMap = new Map<
    string,
    { quota: number; count: number; tokens: number }
  >()

  data.forEach((item) => {
    const timestamp = Number(item.created_at)
    const timeBucket = getChartBucketTimestamp(timestamp, timeGranularity)
    const model = item.model_name || 'Unknown'
    const quota = Number(item.quota) || 0
    const count = Number(item.count) || 0
    const tokens = Number(item.token_used) || 0

    // Aggregate by time and model
    let modelMap = timeModelMap.get(timeBucket)
    if (!modelMap) {
      modelMap = new Map()
      timeModelMap.set(timeBucket, modelMap)
    }
    const existing = modelMap.get(model) || { quota: 0, count: 0, tokens: 0 }
    modelMap.set(model, {
      quota: existing.quota + quota,
      count: existing.count + count,
      tokens: existing.tokens + tokens,
    })

    // Calculate totals
    const totalExisting = modelTotalsMap.get(model) || {
      quota: 0,
      count: 0,
      tokens: 0,
    }
    modelTotalsMap.set(model, {
      quota: totalExisting.quota + quota,
      count: totalExisting.count + count,
      tokens: totalExisting.tokens + tokens,
    })
  })

  const sortedTimes = [...timeModelMap.keys()].sort((a, b) => a - b)
  const sortedModels = [...modelTotalsMap.keys()].sort()
  const modelColorDomain = [...new Set([...sortedModels, otherLabel])]
  const modelColorRange = getDashboardChartColors(modelColorDomain.length)
  const modelColors = new Map(
    modelColorDomain.map((model, index) => [model, modelColorRange[index]])
  )
  const colorForModel = (model: string) =>
    modelColors.get(model) ?? modelColorRange[0]

  // Pad time points if too few (default 7 points)
  const MAX_TREND_POINTS = MAX_CHART_TREND_POINTS
  const fillTimePoints = (times: number[]) => {
    if (times.length >= MAX_TREND_POINTS) return times
    const buckets = new Set(times)
    let cursor = times.at(-1)
    if (cursor === undefined) return times
    while (buckets.size < MAX_TREND_POINTS) {
      if (timeGranularity === 'hour') {
        cursor -= 3600
      } else {
        const date = new Date(cursor * 1000)
        date.setDate(date.getDate() - (timeGranularity === 'week' ? 7 : 1))
        cursor = Math.floor(date.getTime() / 1000)
      }
      buckets.add(cursor)
    }
    return [...buckets].sort((a, b) => a - b)
  }
  const chartTimes = fillTimePoints(sortedTimes)

  const totalTimes = [...modelTotalsMap.values()].reduce(
    (sum, x) => sum + (Number(x.count) || 0),
    0
  )
  const totalQuotaRaw = [...modelTotalsMap.values()].reduce(
    (sum, x) => sum + (Number(x.quota) || 0),
    0
  )

  // Pie chart (model call count proportion)
  const pieRows = [...modelTotalsMap.entries()]
    .map(([model, stats]) => ({
      name: model,
      value: Number(stats.count) || 0,
      fill: colorForModel(model),
    }))
    .sort((a, b) => b.value - a.value)

  // Stacked bars: per-model quota for every time bucket
  const stackedLongRows: LongRow[] = []
  const stackedRawByKey: Record<string, number> = {}

  // Areas: top models by quota + "Other" bucket (too many series = unreadable)
  const MAX_AREA_MODELS = 15
  const topAreaModels = new Set(
    [...modelTotalsMap.entries()]
      .sort((a, b) => (Number(b[1].quota) || 0) - (Number(a[1].quota) || 0))
      .slice(0, MAX_AREA_MODELS)
      .map(([model]) => model)
  )
  const areaLongRows: LongRow[] = []
  const areaRawByKey: Record<string, number> = {}

  chartTimes.forEach((timestamp) => {
    const time = formatChartTime(timestamp, timeGranularity)
    const modelMap = timeModelMap.get(timestamp)
    sortedModels.forEach((model) => {
      const rawQuota = Number(modelMap?.get(model)?.quota) || 0
      const usage = toDisplayQuota(rawQuota)

      stackedLongRows.push({
        [CHART_TIME_KEY]: time,
        [SERIES_NAME_KEY]: model,
        [SERIES_VALUE_KEY]: usage,
      })
      const stackedKey = rawValueKey(time, model)
      stackedRawByKey[stackedKey] =
        (stackedRawByKey[stackedKey] || 0) + rawQuota

      const areaSeries = topAreaModels.has(model) ? model : otherLabel
      areaLongRows.push({
        [CHART_TIME_KEY]: time,
        [SERIES_NAME_KEY]: areaSeries,
        [SERIES_VALUE_KEY]: usage,
      })
      const areaKey = rawValueKey(time, areaSeries)
      areaRawByKey[areaKey] = (areaRawByKey[areaKey] || 0) + rawQuota
    })
  })

  const stackedQuota = pivotSeries(
    stackedLongRows,
    CHART_TIME_KEY,
    SERIES_NAME_KEY,
    SERIES_VALUE_KEY
  )
  const areaQuota = pivotSeries(
    areaLongRows,
    CHART_TIME_KEY,
    SERIES_NAME_KEY,
    SERIES_VALUE_KEY
  )

  // Call trend: top models by count + "Other" bucket
  const MAX_TREND_MODELS = 20
  const rankedTrendModels = [...modelTotalsMap.entries()]
    .map(([model, stats]) => ({ model, count: Number(stats.count) || 0 }))
    .sort((a, b) => b.count - a.count)
  const topTrendModels = rankedTrendModels
    .slice(0, MAX_TREND_MODELS)
    .map((item) => item.model)
  const otherTrendModels = rankedTrendModels
    .slice(MAX_TREND_MODELS)
    .map((item) => item.model)

  const trendLongRows: LongRow[] = []
  chartTimes.forEach((timestamp) => {
    const time = formatChartTime(timestamp, timeGranularity)
    const modelMap = timeModelMap.get(timestamp)
    topTrendModels.forEach((model) => {
      trendLongRows.push({
        [CHART_TIME_KEY]: time,
        [SERIES_NAME_KEY]: model,
        [SERIES_VALUE_KEY]: Number(modelMap?.get(model)?.count) || 0,
      })
    })
    if (otherTrendModels.length > 0) {
      const otherCount = otherTrendModels.reduce(
        (sum, model) => sum + (Number(modelMap?.get(model)?.count) || 0),
        0
      )
      trendLongRows.push({
        [CHART_TIME_KEY]: time,
        [SERIES_NAME_KEY]: otherLabel,
        [SERIES_VALUE_KEY]: otherCount,
      })
    }
  })
  const trendCount = pivotSeries(
    trendLongRows,
    CHART_TIME_KEY,
    SERIES_NAME_KEY,
    SERIES_VALUE_KEY
  )

  // Rank bars: model call count ranking (top 20 + "Other" bucket)
  const MAX_RANK_MODELS = 20
  const rankedCounts = rankedTrendModels.map((item) => ({
    name: item.model,
    value: item.count,
    fill: colorForModel(item.model),
  }))
  let rankRows = rankedCounts
  if (rankedCounts.length > MAX_RANK_MODELS) {
    const otherCount = rankedCounts
      .slice(MAX_RANK_MODELS)
      .reduce((sum, item) => sum + item.value, 0)
    rankRows = [
      ...rankedCounts.slice(0, MAX_RANK_MODELS),
      { name: otherLabel, value: otherCount, fill: colorForModel(otherLabel) },
    ]
  }

  return {
    pie: {
      rows: pieRows,
      title: tt('Call Count Distribution'),
    },
    stackedQuota: {
      rows: stackedQuota.rows,
      xKey: CHART_TIME_KEY,
      seriesKeys: orderSeriesKeys(stackedQuota.seriesKeys, otherLabel),
      rawByKey: stackedRawByKey,
      valueKind: 'quota',
      stacked: true,
      title: tt('Quota Distribution'),
    },
    areaQuota: {
      rows: areaQuota.rows,
      xKey: CHART_TIME_KEY,
      seriesKeys: orderSeriesKeys(areaQuota.seriesKeys, otherLabel),
      rawByKey: areaRawByKey,
      valueKind: 'quota',
      stacked: false,
      title: tt('Quota Distribution'),
    },
    trendCount: {
      rows: trendCount.rows,
      xKey: CHART_TIME_KEY,
      seriesKeys: orderSeriesKeys(trendCount.seriesKeys, otherLabel),
      valueKind: 'count',
      stacked: false,
      title: tt('Call Trend'),
    },
    rankCount: {
      rows: rankRows,
      valueKind: 'count',
      layout: 'horizontal',
      title: tt('Call Count Ranking'),
    },
    totalQuotaDisplay: formatQuotaTotal(totalQuotaRaw),
    totalCountDisplay: formatInt(totalTimes),
  }
}

export function processUserChartData(
  data: QuotaDataItem[],
  timeGranularity: TimeGranularity = 'day',
  t?: TFunction,
  limit = 10
): ProcessedUserChartData {
  const tt: TFunction = t ?? ((x) => x)
  const { config, meta } = getCurrencyDisplay()
  const quotaPerUnit = config.quotaPerUnit
  const toDisplayQuota = (rawQuota: number) => {
    if (!rawQuota) return 0
    if (meta.kind === 'tokens') return rawQuota
    return Number((rawQuota / quotaPerUnit).toFixed(4))
  }

  if (!data || data.length === 0) {
    return {
      rank: {
        rows: [],
        valueKind: 'quota',
        layout: 'vertical',
        title: tt('User Consumption Ranking'),
        subtext: tt('No data available'),
      },
      trend: emptySeriesChart(tt('User Consumption Trend'), 'quota'),
    }
  }

  const userQuotaTotal = new Map<string, number>()
  data.forEach((item) => {
    const username = item.username || 'unknown'
    const prev = userQuotaTotal.get(username) || 0
    userQuotaTotal.set(username, prev + (Number(item.quota) || 0))
  })

  const sorted = [...userQuotaTotal.entries()].sort((a, b) => b[1] - a[1])
  const rankedUsers = sorted.slice(0, limit)
  const topUsers = rankedUsers.map(([user]) => user)
  const topUserSet = new Set(topUsers)
  const totalQuota = rankedUsers.reduce((sum, [, quota]) => sum + quota, 0)

  const rankRows = rankedUsers.map(([username, quota], index) => ({
    name: username,
    value: toDisplayQuota(quota),
    fill: USER_CHART_COLORS[index % USER_CHART_COLORS.length],
  }))

  const timeUserMap = new Map<number, Map<string, number>>()
  const allTimePoints = new Set<number>()

  data.forEach((item) => {
    const ts = Number(item.created_at)
    const timeBucket = getChartBucketTimestamp(ts, timeGranularity)
    allTimePoints.add(timeBucket)
    const user = item.username || 'unknown'
    if (!topUserSet.has(user)) return
    let map = timeUserMap.get(timeBucket)
    if (!map) {
      map = new Map()
      timeUserMap.set(timeBucket, map)
    }
    map.set(user, (map.get(user) || 0) + (Number(item.quota) || 0))
  })

  const trendLongRows: LongRow[] = []
  const trendRawByKey: Record<string, number> = {}
  const sortedTimePoints = [...allTimePoints].sort((a, b) => a - b)

  sortedTimePoints.forEach((timestamp) => {
    const time = formatChartTime(timestamp, timeGranularity)
    topUsers.forEach((user) => {
      const rawQuota = timeUserMap.get(timestamp)?.get(user) || 0
      trendLongRows.push({
        [CHART_TIME_KEY]: time,
        [SERIES_NAME_KEY]: user,
        [SERIES_VALUE_KEY]: toDisplayQuota(rawQuota),
      })
      const key = rawValueKey(time, user)
      trendRawByKey[key] = (trendRawByKey[key] || 0) + rawQuota
    })
  })

  const trend = pivotSeries(
    trendLongRows,
    CHART_TIME_KEY,
    SERIES_NAME_KEY,
    SERIES_VALUE_KEY
  )

  return {
    rank: {
      rows: rankRows,
      valueKind: 'quota',
      layout: 'vertical',
      title: tt('User Consumption Ranking'),
      subtext: `${tt('Total:')} ${renderQuotaCompat(totalQuota, 2)}`,
    },
    trend: {
      rows: trend.rows,
      xKey: CHART_TIME_KEY,
      // Users keep the ranking order so colors match the rank chart.
      seriesKeys: topUsers.filter((user) => trend.seriesKeys.includes(user)),
      rawByKey: trendRawByKey,
      valueKind: 'quota',
      stacked: false,
      title: tt('User Consumption Trend'),
    },
  }
}
