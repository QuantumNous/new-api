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
import { dataScheme as vchartDefaultDataScheme } from '@visactor/vchart/esm/theme/color-scheme/builtin/default'

import { MAX_CHART_TREND_POINTS } from '@/features/dashboard/constants'
import type {
  QuotaDataItem,
  ProcessedChartData,
  ProcessedUserChartData,
  CacheRateChartRow,
  CacheRateMetric,
  VChartSpec,
} from '@/features/dashboard/types'
import { getCurrencyDisplay } from '@/lib/currency'
import { formatChartTime, type TimeGranularity } from '@/lib/time'

type TFunction = (key: string) => string
type TooltipLineItem = {
  key: string
  value: string | number
  datum?: Record<string, unknown>
  hasShape?: boolean
  shapeType?: string
  shapeFill?: string
  shapeStroke?: string
  shapeSize?: number
}

export function getDashboardChartColors(domainLength: number): string[] {
  const scheme =
    vchartDefaultDataScheme.find(
      (item) => !item.maxDomainLength || domainLength <= item.maxDomainLength
    ) ?? vchartDefaultDataScheme.at(-1)

  if (!scheme) return []
  return scheme.scheme.filter(
    (color): color is string => typeof color === 'string'
  )
}

function renderQuotaCompat(rawQuota: number, digits = 4): string {
  const { config, meta } = getCurrencyDisplay()
  if (meta.kind === 'tokens') return rawQuota.toLocaleString()
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

/**
 * Process and aggregate chart data
 */
export function processChartData(
  data: QuotaDataItem[],
  timeGranularity: TimeGranularity = 'day',
  t?: TFunction,
  chartCornerRadius?: number
): ProcessedChartData {
  const tt: TFunction = t ?? ((x) => x)
  const otherLabel = tt('Other')

  const formatInt = (value: number) =>
    Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
  const formatQuotaValue = (value: number) => renderQuotaCompat(value, 4)
  const formatQuotaTotal = (value: number) => renderQuotaCompat(value, 2)

  const MAX_TOOLTIP_MODELS = 15
  const isOtherTooltipKey = (key: string) =>
    key === 'Other' || key === otherLabel

  const makeTooltipDimensionUpdateContent = (options?: {
    collapseOverflow?: boolean
  }) => {
    const collapseOverflow = options?.collapseOverflow ?? true

    return (array: TooltipLineItem[]) => {
      const modelItems = array.filter((item) => !isOtherTooltipKey(item.key))
      const otherItems = array.filter((item) => isOtherTooltipKey(item.key))
      modelItems.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
      array = [...modelItems, ...otherItems]

      let sum = 0
      for (let i = 0; i < array.length; i++) {
        const v = Number(array[i].value) || 0
        if (
          array[i].datum &&
          (array[i].datum as Record<string, unknown>)?.TimeSum
        ) {
          sum =
            Number((array[i].datum as Record<string, unknown>)?.TimeSum) || sum
        }
        array[i].value = formatQuotaValue(v)
      }

      if (collapseOverflow && array.length > MAX_TOOLTIP_MODELS) {
        const visible = modelItems.slice(0, MAX_TOOLTIP_MODELS)
        const otherSum = [
          ...modelItems.slice(MAX_TOOLTIP_MODELS),
          ...otherItems,
        ].reduce((sum, item) => {
          const raw = item.datum
            ? Number((item.datum as Record<string, unknown>)?.rawQuota) || 0
            : 0
          return sum + raw
        }, 0)
        array = [
          ...visible,
          {
            key: otherLabel,
            value: formatQuotaValue(otherSum),
            hasShape: true,
            shapeType: 'square',
            shapeFill: otherTooltipColor,
            shapeStroke: otherTooltipColor,
            shapeSize: 8,
          },
        ]
      }

      array.unshift({
        key: tt('Total:'),
        value: formatQuotaValue(sum),
      })
      return array
    }
  }

  if (!data || data.length === 0) {
    return {
      spec_pie: {
        type: 'pie',
        data: [{ id: 'id0', values: [] }],
        outerRadius: 0.8,
        innerRadius: 0.5,
        padAngle: 0.6,
        valueField: 'value',
        categoryField: 'type',
        title: {
          visible: true,
          text: tt('Call Count Distribution'),
          subtext: tt('No data available'),
        },
        legends: { visible: false },
        label: { visible: false },
        tooltip: {
          mark: {
            content: [],
          },
        },
      },
      spec_line: {
        type: 'bar',
        data: [{ id: 'barData', values: [] }],
        xField: 'Time',
        yField: 'Usage',
        seriesField: 'Model',
        stack: true,
        legends: { visible: true, selectMode: 'single' },
      },
      spec_area: {
        type: 'area',
        data: [{ id: 'areaData', values: [] }],
        xField: 'Time',
        yField: 'Usage',
        seriesField: 'Model',
        stack: true,
        legends: { visible: true, selectMode: 'single' },
      },
      spec_model_line: {
        type: 'area',
        data: [{ id: 'lineData', values: [] }],
        xField: 'Time',
        yField: 'Count',
        seriesField: 'Model',
        legends: { visible: true, selectMode: 'single' },
        title: {
          visible: true,
          text: tt('Call Trend'),
        },
      },
      spec_rank_bar: {
        type: 'bar',
        data: [{ id: 'rankData', values: [] }],
        xField: 'Model',
        yField: 'Count',
        seriesField: 'Model',
        legends: { visible: true, selectMode: 'single' },
        title: {
          visible: true,
          text: tt('Call Count Ranking'),
        },
      },
      totalQuotaDisplay: formatQuotaTotal(0),
      totalCountDisplay: formatInt(0),
    }
  }

  const { config } = getCurrencyDisplay()
  const quotaPerUnit = config.quotaPerUnit

  // Aggregate all metrics by time and model
  const timeModelMap = new Map<
    string,
    Map<string, { quota: number; count: number; tokens: number }>
  >()
  const modelTotalsMap = new Map<
    string,
    { quota: number; count: number; tokens: number }
  >()

  data.forEach((item) => {
    const timestamp = Number(item.created_at)
    const timeKey = formatChartTime(timestamp, timeGranularity)
    const model = item.model_name || 'Unknown'
    const quota = Number(item.quota) || 0
    const count = Number(item.count) || 0
    const tokens = Number(item.token_used) || 0

    // Aggregate by time and model
    let modelMap = timeModelMap.get(timeKey)
    if (!modelMap) {
      modelMap = new Map()
      timeModelMap.set(timeKey, modelMap)
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

  const allModels = [...modelTotalsMap.keys()]
  const sortedTimes = [...timeModelMap.keys()].sort()
  const sortedModels = [...allModels].sort()
  const modelColorDomain = [...new Set([...sortedModels, otherLabel])]
  const modelColorRange = getDashboardChartColors(modelColorDomain.length)
  const otherColor = modelColorRange[modelColorDomain.indexOf(otherLabel)]
  const otherTooltipColor =
    typeof otherColor === 'string' ? otherColor : '#FF8A00'
  const modelColor = {
    type: 'ordinal',
    domain: modelColorDomain,
    range: modelColorRange,
  }

  // Pad time points if too few (default 7 points)
  const MAX_TREND_POINTS = MAX_CHART_TREND_POINTS
  const fillTimePoints = (times: string[]) => {
    if (times.length >= MAX_TREND_POINTS) return times
    const lastTime = Math.max(
      ...data.map((item) => Number(item.created_at) || 0)
    )
    let intervalSec = 3600
    if (timeGranularity === 'week') intervalSec = 604800
    else if (timeGranularity === 'day') intervalSec = 86400
    const padded = Array.from({ length: MAX_TREND_POINTS }, (_, i) =>
      formatChartTime(
        lastTime - (MAX_TREND_POINTS - 1 - i) * intervalSec,
        timeGranularity
      )
    )
    return padded
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
  const pieValues = [...modelTotalsMap.entries()]
    .map(([model, stats]) => ({
      type: model,
      value: Number(stats.count) || 0,
    }))
    .sort((a, b) => b.value - a.value)

  // Stacked bar: model quota distribution (quota -> USD)
  const lineValues: Array<{
    Time: string
    Model: string
    rawQuota: number
    Usage: number
    TimeSum: number
  }> = []

  chartTimes.forEach((time) => {
    let timeData = sortedModels.map((model) => {
      const stats = timeModelMap.get(time)?.get(model)
      const rawQuota = Number(stats?.quota) || 0
      const usd = rawQuota ? rawQuota / quotaPerUnit : 0
      // Match legacy frontend getQuotaWithUnit(..., 4)
      const usage = usd ? Number(usd.toFixed(4)) : 0
      return {
        Time: time,
        Model: model,
        rawQuota,
        Usage: usage,
        TimeSum: 0,
      }
    })

    const timeSum = timeData.reduce((sum, item) => sum + item.rawQuota, 0)
    timeData.sort((a, b) => b.rawQuota - a.rawQuota)
    timeData = timeData.map((item) => ({ ...item, TimeSum: timeSum }))
    lineValues.push(...timeData)
  })
  lineValues.sort((a, b) => a.Time.localeCompare(b.Time))

  // Area chart: top models by quota + "Other" bucket (too many series = unreadable)
  const MAX_AREA_MODELS = 15
  const rankedQuotaModels = [...modelTotalsMap.entries()]
    .map(([model, stats]) => ({
      Model: model,
      Quota: Number(stats.quota) || 0,
    }))
    .sort((a, b) => b.Quota - a.Quota)
  const topAreaModels = new Set(
    rankedQuotaModels.slice(0, MAX_AREA_MODELS).map((m) => m.Model)
  )

  const areaValues: typeof lineValues = []
  chartTimes.forEach((time) => {
    const buckets = new Map<string, { rawQuota: number; usage: number }>()
    const modelMap = timeModelMap.get(time)
    let timeSum = 0
    sortedModels.forEach((model) => {
      const stats = modelMap?.get(model)
      const rawQuota = Number(stats?.quota) || 0
      const usd = rawQuota ? rawQuota / quotaPerUnit : 0
      const usage = usd ? Number(usd.toFixed(4)) : 0
      timeSum += rawQuota
      const key = topAreaModels.has(model) ? model : otherLabel
      const prev = buckets.get(key) || { rawQuota: 0, usage: 0 }
      buckets.set(key, {
        rawQuota: prev.rawQuota + rawQuota,
        usage: Number((prev.usage + usage).toFixed(4)),
      })
    })
    for (const [model, vals] of buckets) {
      areaValues.push({
        Time: time,
        Model: model,
        rawQuota: vals.rawQuota,
        Usage: vals.usage,
        TimeSum: timeSum,
      })
    }
  })
  areaValues.sort((a, b) => a.Time.localeCompare(b.Time))

  // Line chart: model call trend (top models + "Other" bucket)
  const MAX_TREND_MODELS = 20
  const rankedTrendModels = [...modelTotalsMap.entries()]
    .map(([model, stats]) => ({
      Model: model,
      Count: Number(stats.count) || 0,
    }))
    .sort((a, b) => b.Count - a.Count)
  const topTrendModels = rankedTrendModels
    .slice(0, MAX_TREND_MODELS)
    .map((item) => item.Model)
  const otherTrendModels = rankedTrendModels
    .slice(MAX_TREND_MODELS)
    .map((item) => item.Model)

  const modelLineValues: Array<{
    Time: string
    Model: string
    Count: number
  }> = []
  chartTimes.forEach((time) => {
    const timeData = topTrendModels.map((model) => {
      const stats = timeModelMap.get(time)?.get(model)
      return {
        Time: time,
        Model: model,
        Count: Number(stats?.count) || 0,
      }
    })
    if (otherTrendModels.length > 0) {
      const otherCount = otherTrendModels.reduce((sum, model) => {
        const stats = timeModelMap.get(time)?.get(model)
        return sum + (Number(stats?.count) || 0)
      }, 0)
      timeData.push({
        Time: time,
        Model: otherLabel,
        Count: otherCount,
      })
    }
    modelLineValues.push(...timeData)
  })
  modelLineValues.sort((a, b) => a.Time.localeCompare(b.Time))

  // Rank bar: model call count ranking (top 20 + "Other" bucket)
  const MAX_RANK_MODELS = 20
  const allRankValues = [...modelTotalsMap.entries()]
    .map(([model, stats]) => ({
      Model: model,
      Count: Number(stats.count) || 0,
    }))
    .sort((a, b) => b.Count - a.Count)

  let rankValues: typeof allRankValues
  if (allRankValues.length > MAX_RANK_MODELS) {
    const topModels = allRankValues.slice(0, MAX_RANK_MODELS)
    const otherCount = allRankValues
      .slice(MAX_RANK_MODELS)
      .reduce((sum, item) => sum + item.Count, 0)
    rankValues = [...topModels, { Model: otherLabel, Count: otherCount }]
  } else {
    rankValues = allRankValues
  }

  return {
    spec_pie: {
      type: 'pie',
      data: [{ id: 'id0', values: pieValues }],
      outerRadius: 0.8,
      innerRadius: 0.5,
      padAngle: 0.6,
      valueField: 'value',
      categoryField: 'type',
      pie: {
        style:
          chartCornerRadius == null ? {} : { cornerRadius: chartCornerRadius },
        state: {
          hover: { outerRadius: 0.85, stroke: '#000', lineWidth: 1 },
          selected: { outerRadius: 0.85, stroke: '#000', lineWidth: 1 },
        },
      },
      title: {
        visible: true,
        text: tt('Call Count Distribution'),
      },
      legends: { visible: true, orient: 'left' },
      label: { visible: true },
      color: modelColor,
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.type,
              value: (datum: Record<string, unknown>) =>
                formatInt(Number(datum?.value) || 0),
            },
          ],
        },
      },
      background: { fill: 'transparent' },
      animation: true,
    },
    spec_line: {
      type: 'bar',
      data: [{ id: 'barData', values: lineValues }],
      xField: 'Time',
      yField: 'Usage',
      seriesField: 'Model',
      stack: true,
      legends: { visible: true, selectMode: 'single' },
      color: modelColor,
      bar: {
        state: {
          hover: { stroke: '#000', lineWidth: 1 },
        },
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.Model,
              value: (datum: Record<string, unknown>) =>
                formatQuotaValue(Number(datum?.rawQuota) || 0),
            },
          ],
        },
        dimension: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.Model,
              value: (datum: Record<string, unknown>) =>
                Number(datum?.rawQuota) || 0,
            },
          ],
          updateContent: makeTooltipDimensionUpdateContent(),
        },
      },
      background: { fill: 'transparent' },
      animation: true,
    },
    spec_area: {
      type: 'area',
      data: [{ id: 'areaData', values: areaValues }],
      xField: 'Time',
      yField: 'Usage',
      seriesField: 'Model',
      stack: false,
      legends: { visible: true, selectMode: 'single' },
      color: modelColor,
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.Model,
              value: (datum: Record<string, unknown>) =>
                formatQuotaValue(Number(datum?.rawQuota) || 0),
            },
          ],
        },
        dimension: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.Model,
              value: (datum: Record<string, unknown>) =>
                Number(datum?.rawQuota) || 0,
            },
          ],
          updateContent: makeTooltipDimensionUpdateContent({
            collapseOverflow: false,
          }),
        },
      },
      area: {
        style: {
          fillOpacity: 0.08,
          curveType: 'monotone',
        },
      },
      line: {
        style: {
          lineWidth: 2,
          curveType: 'monotone',
        },
      },
      point: { visible: false },
      background: { fill: 'transparent' },
      animation: true,
    },
    spec_model_line: {
      type: 'area',
      data: [{ id: 'lineData', values: modelLineValues }],
      xField: 'Time',
      yField: 'Count',
      seriesField: 'Model',
      stack: false,
      legends: { visible: true, selectMode: 'single' },
      color: modelColor,
      title: {
        visible: true,
        text: tt('Call Trend'),
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.Model,
              value: (datum: Record<string, unknown>) =>
                formatInt(Number(datum?.Count) || 0),
            },
          ],
        },
        dimension: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.Model,
              value: (datum: Record<string, unknown>) =>
                Number(datum?.Count) || 0,
            },
          ],
          updateContent: (
            array: Array<{
              key: string
              value: string | number
            }>
          ) => {
            const modelItems = array.filter(
              (item) => !isOtherTooltipKey(item.key)
            )
            const otherItems = array.filter((item) =>
              isOtherTooltipKey(item.key)
            )
            modelItems.sort(
              (a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)
            )
            array = [...modelItems, ...otherItems]

            let sum = 0
            for (let i = 0; i < array.length; i++) {
              const v = Number(array[i].value) || 0
              sum += v
              array[i].value = formatInt(v)
            }
            array.unshift({
              key: tt('Total:'),
              value: formatInt(sum),
            })
            return array
          },
        },
      },
      area: {
        style: {
          fillOpacity: 0.08,
          curveType: 'monotone',
        },
      },
      line: {
        style: {
          lineWidth: 2,
          curveType: 'monotone',
        },
      },
      point: { visible: false },
      background: { fill: 'transparent' },
      animation: true,
    },
    spec_rank_bar: {
      type: 'bar',
      data: [{ id: 'rankData', values: rankValues }],
      xField: 'Model',
      yField: 'Count',
      seriesField: 'Model',
      legends: { visible: true, selectMode: 'single' },
      color: modelColor,
      title: {
        visible: true,
        text: tt('Call Count Ranking'),
      },
      bar: {
        state: {
          hover: { stroke: '#000', lineWidth: 1 },
        },
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.Model,
              value: (datum: Record<string, unknown>) =>
                formatInt(Number(datum?.Count) || 0),
            },
          ],
        },
      },
      background: { fill: 'transparent' },
      animation: true,
    },
    totalQuotaDisplay: formatQuotaTotal(totalQuotaRaw),
    totalCountDisplay: formatInt(totalTimes),
  }
}

const CACHE_RATE_METRIC_TITLES: Record<CacheRateMetric, string> = {
  read: 'Cache Read Rate',
  creation: 'Cache Creation Rate',
  hit: 'Cache Hit Rate',
}

// One line per series; more becomes unreadable. Series are ranked by input
// token volume (the rate denominator) so the busiest models/channels stay.
const MAX_CACHE_RATE_SERIES = 10

export interface CacheRateChartOptions {
  metric: CacheRateMetric
  timeGranularity: TimeGranularity
  t?: TFunction
}

/**
 * Build a line chart spec showing the cache read/creation rate per time
 * bucket for up to 10 series (models or channels).
 *
 * Rates are share-of-input-tokens (sum(cache) / sum(prompt) per bucket),
 * clamped at 100% because OpenAI cache-write counts and OpenRouter-Claude
 * prompt bases can make the naive ratio exceed 1.
 */
export function processCacheRateChartData(
  rows: CacheRateChartRow[],
  options: CacheRateChartOptions
): VChartSpec {
  const tt: TFunction = options.t ?? ((x) => x)
  const metricTitle = tt(CACHE_RATE_METRIC_TITLES[options.metric])
  const timeGranularity = options.timeGranularity
  const formatRate = (value: number) => `${(Number(value) || 0).toFixed(1)}%`

  const emptySpec = {
    type: 'line',
    data: [{ id: 'cacheRateData', values: [] }],
    xField: 'Time',
    yField: 'Rate',
    seriesField: 'Series',
    title: {
      visible: true,
      text: metricTitle,
      subtext: tt('No data available'),
    },
    legends: { visible: true, selectMode: 'single' },
    background: { fill: 'transparent' },
  }

  if (!rows || rows.length === 0) return emptySpec

  // Aggregate per time bucket and series.
  const timeSeriesMap = new Map<
    string,
    Map<
      string,
      {
        prompt: number
        cacheRead: number
        cacheWrite: number
        count: number
        hits: number
      }
    >
  >()
  // All-series totals per time bucket (not limited to the top-10 series), so
  // the tooltip "Total" row matches the stat cards' whole-range rate.
  const timeTotalsMap = new Map<
    string,
    {
      prompt: number
      cacheRead: number
      cacheWrite: number
      count: number
      hits: number
    }
  >()
  // Series ranking key: requests for the hit metric, input tokens otherwise.
  const seriesRankTotals = new Map<string, number>()
  const allTimePoints = new Set<string>()
  let lastTimestamp = 0

  rows.forEach((row) => {
    const timestamp = Number(row.created_at) || 0
    lastTimestamp = Math.max(lastTimestamp, timestamp)
    const timeKey = formatChartTime(timestamp, timeGranularity)
    const series = row.series || 'Unknown'
    allTimePoints.add(timeKey)

    const prompt = Number(row.prompt_tokens) || 0
    const cacheRead = Number(row.cache_tokens) || 0
    const cacheWrite = Number(row.cache_creation_tokens) || 0
    const count = Number(row.count) || 0
    const hits = Number(row.cache_hit_count) || 0
    const rankValue = options.metric === 'hit' ? count : prompt
    seriesRankTotals.set(series, (seriesRankTotals.get(series) || 0) + rankValue)

    const timeTotals = timeTotalsMap.get(timeKey) || {
      prompt: 0,
      cacheRead: 0,
      cacheWrite: 0,
      count: 0,
      hits: 0,
    }
    timeTotalsMap.set(timeKey, {
      prompt: timeTotals.prompt + prompt,
      cacheRead: timeTotals.cacheRead + cacheRead,
      cacheWrite: timeTotals.cacheWrite + cacheWrite,
      count: timeTotals.count + count,
      hits: timeTotals.hits + hits,
    })

    let seriesMap = timeSeriesMap.get(timeKey)
    if (!seriesMap) {
      seriesMap = new Map()
      timeSeriesMap.set(timeKey, seriesMap)
    }
    const existing = seriesMap.get(series) || {
      prompt: 0,
      cacheRead: 0,
      cacheWrite: 0,
      count: 0,
      hits: 0,
    }
    seriesMap.set(series, {
      prompt: existing.prompt + prompt,
      cacheRead: existing.cacheRead + cacheRead,
      cacheWrite: existing.cacheWrite + cacheWrite,
      count: existing.count + count,
      hits: existing.hits + hits,
    })
  })

  // Pad time points when the range is short so the x-axis stays readable.
  let chartTimes = [...allTimePoints].sort()
  if (chartTimes.length < MAX_CHART_TREND_POINTS) {
    let intervalSec = 3600
    if (timeGranularity === 'week') intervalSec = 604800
    else if (timeGranularity === 'day') intervalSec = 86400
    chartTimes = Array.from({ length: MAX_CHART_TREND_POINTS }, (_, i) =>
      formatChartTime(
        lastTimestamp - (MAX_CHART_TREND_POINTS - 1 - i) * intervalSec,
        timeGranularity
      )
    )
  }

  const topSeries = [...seriesRankTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CACHE_RATE_SERIES)
    .map(([series]) => series)

  const values: Array<{
    Time: string
    Series: string
    Rate: number
    TimePrompt: number
    TimeCache: number
    TimeCount: number
    TimeHits: number
  }> = []
  chartTimes.forEach((time) => {
    const seriesMap = timeSeriesMap.get(time)
    const totals = timeTotalsMap.get(time)
    const timePrompt = totals?.prompt ?? 0
    let timeCache = 0
    if (totals) {
      timeCache =
        options.metric === 'read' ? totals.cacheRead : totals.cacheWrite
    }
    const timeCount = totals?.count ?? 0
    const timeHits = totals?.hits ?? 0
    topSeries.forEach((series) => {
      const agg = seriesMap?.get(series)
      if (!agg) return
      if (options.metric === 'hit') {
        // Request-count hit rate: cache-hit requests / total requests.
        if (agg.count <= 0) return
        const rate = Math.min(agg.hits / agg.count, 1) * 100
        values.push({
          Time: time,
          Series: series,
          Rate: Math.round(rate * 10) / 10,
          TimePrompt: timePrompt,
          TimeCache: timeCache,
          TimeCount: timeCount,
          TimeHits: timeHits,
        })
        return
      }
      // Token-based read/creation rate: cache tokens / input tokens.
      const prompt = agg.prompt
      if (prompt <= 0) return
      const numerator =
        options.metric === 'read' ? agg.cacheRead : agg.cacheWrite
      const rate = Math.min(numerator / prompt, 1) * 100
      values.push({
        Time: time,
        Series: series,
        Rate: Math.round(rate * 10) / 10,
        TimePrompt: timePrompt,
        TimeCache: timeCache,
        TimeCount: timeCount,
        TimeHits: timeHits,
      })
    })
  })
  if (values.length === 0) return emptySpec

  const colorDomain = [...topSeries].sort()
  const colorRange = getDashboardChartColors(colorDomain.length)

  return {
    type: 'line',
    data: [{ id: 'cacheRateData', values }],
    xField: 'Time',
    yField: 'Rate',
    seriesField: 'Series',
    stack: false,
    legends: { visible: true, selectMode: 'single' },
    color: {
      type: 'ordinal',
      domain: colorDomain,
      range: colorRange,
    },
    title: {
      visible: true,
      text: metricTitle,
    },
    axes: [
      { orient: 'bottom', type: 'band' },
      {
        orient: 'left',
        type: 'linear',
        max: 100,
        label: {
          formatMethod: (value: number) => `${value}%`,
        },
      },
    ],
    tooltip: {
      mark: {
        content: [
          {
            key: (datum: Record<string, unknown>) => datum?.Series,
            value: (datum: Record<string, unknown>) =>
              formatRate(Number(datum?.Rate) || 0),
          },
        ],
      },
      dimension: {
        content: [
          {
            key: (datum: Record<string, unknown>) => datum?.Series,
            value: (datum: Record<string, unknown>) =>
              Number(datum?.Rate) || 0,
          },
        ],
        updateContent: (
          array: Array<{
            key: string
            value: string | number
            datum?: Record<string, unknown>
          }>
        ) => {
          array.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
          for (let i = 0; i < array.length; i++) {
            array[i].value = formatRate(Number(array[i].value) || 0)
          }
          if (array.length > 0) {
            const first = array[0].datum as
              | {
                  TimePrompt?: number
                  TimeCache?: number
                  TimeCount?: number
                  TimeHits?: number
                }
              | undefined
            if (!first) return array
            if (options.metric === 'hit') {
              const denominator = Number(first.TimeCount) || 0
              if (denominator > 0) {
                const overall = (Number(first.TimeHits) || 0) / denominator
                array.unshift({
                  key: tt('Total:'),
                  value: formatRate(Math.min(overall, 1) * 100),
                })
              }
            } else if (Number(first.TimePrompt) > 0) {
              const overall =
                (Number(first.TimeCache) || 0) / Number(first.TimePrompt)
              array.unshift({
                key: tt('Total:'),
                value: formatRate(Math.min(overall, 1) * 100),
              })
            }
          }
          return array
        },
      },
    },
    line: {
      style: {
        lineWidth: 2,
        curveType: 'monotone',
      },
    },
    point: { visible: false },
    background: { fill: 'transparent' },
    animation: true,
  }
}

const USER_COLORS = [
  '#5B8FF9',
  '#5AD8A6',
  '#F6BD16',
  '#E8684A',
  '#6DC8EC',
  '#9270CA',
  '#FF9D4D',
  '#269A99',
  '#FF99C3',
  '#5D7092',
]

export function processUserChartData(
  data: QuotaDataItem[],
  timeGranularity: TimeGranularity = 'day',
  t?: TFunction,
  limit = 10
): ProcessedUserChartData {
  const tt: TFunction = t ?? ((x) => x)
  const { config } = getCurrencyDisplay()
  const quotaPerUnit = config.quotaPerUnit

  const formatVal = (raw: number) => renderQuotaCompat(raw, 2)

  const emptyResult: ProcessedUserChartData = {
    spec_user_rank: {
      type: 'bar',
      data: [{ id: 'userRankData', values: [] }],
      xField: 'rawQuota',
      yField: 'User',
      seriesField: 'User',
      direction: 'horizontal',
      title: {
        visible: true,
        text: tt('User Consumption Ranking'),
        subtext: tt('No data available'),
      },
      legends: { visible: false },
      color: { type: 'ordinal', range: USER_COLORS },
      background: { fill: 'transparent' },
    },
    spec_user_trend: {
      type: 'area',
      data: [{ id: 'userTrendData', values: [] }],
      xField: 'Time',
      yField: 'rawQuota',
      seriesField: 'User',
      title: {
        visible: true,
        text: tt('User Consumption Trend'),
        subtext: tt('No data available'),
      },
      legends: { visible: true, selectMode: 'single' },
      color: { type: 'ordinal', range: USER_COLORS },
      point: { visible: false },
      background: { fill: 'transparent' },
    },
  }

  if (!data || data.length === 0) return emptyResult

  const userQuotaTotal = new Map<string, number>()
  data.forEach((item) => {
    const username = item.username || 'unknown'
    const prev = userQuotaTotal.get(username) || 0
    userQuotaTotal.set(username, prev + (Number(item.quota) || 0))
  })

  const sorted = [...userQuotaTotal.entries()].sort(
    (a, b) => b[1] - a[1]
  )
  const topUsers = sorted.slice(0, limit).map(([u]) => u)
  const topUserSet = new Set(topUsers)
  const totalQuota = sorted.slice(0, limit).reduce((s, [, q]) => s + q, 0)

  const rankValues = sorted.slice(0, limit).map(([username, quota]) => ({
    User: username,
    rawQuota: quota,
    Usage: Number((quota / quotaPerUnit).toFixed(4)),
  }))

  const userColorMap = topUsers.reduce<Record<string, string>>(
    (acc, user, i) => {
      acc[user] = USER_COLORS[i % USER_COLORS.length]
      return acc
    },
    {}
  )

  const timeUserMap = new Map<string, Map<string, number>>()
  const allTimePoints = new Set<string>()

  data.forEach((item) => {
    const ts = Number(item.created_at)
    const timeKey = formatChartTime(ts, timeGranularity)
    allTimePoints.add(timeKey)
    const user = item.username || 'unknown'
    if (!topUserSet.has(user)) return
    let userMap = timeUserMap.get(timeKey)
    if (!userMap) {
      userMap = new Map()
      timeUserMap.set(timeKey, userMap)
    }
    userMap.set(user, (userMap.get(user) || 0) + (Number(item.quota) || 0))
  })

  const sortedTimePoints = [...allTimePoints].sort()
  const trendValues: Array<{
    Time: string
    User: string
    rawQuota: number
    Usage: number
  }> = []

  sortedTimePoints.forEach((time) => {
    topUsers.forEach((user) => {
      const q = timeUserMap.get(time)?.get(user) || 0
      trendValues.push({
        Time: time,
        User: user,
        rawQuota: q,
        Usage: Number((q / quotaPerUnit).toFixed(4)),
      })
    })
  })

  return {
    spec_user_rank: {
      type: 'bar',
      data: [{ id: 'userRankData', values: rankValues }],
      xField: 'rawQuota',
      yField: 'User',
      seriesField: 'User',
      direction: 'horizontal',
      title: {
        visible: true,
        text: tt('User Consumption Ranking'),
        subtext: `${tt('Total:')} ${formatVal(totalQuota)}`,
      },
      legends: { visible: false },
      bar: {
        state: { hover: { stroke: '#000', lineWidth: 1 } },
      },
      label: {
        visible: true,
        position: 'outside',
        formatMethod: (value: number) => formatVal(value),
        style: { fontSize: 11 },
      },
      axes: [
        { orient: 'left', type: 'band' },
        { orient: 'bottom', type: 'linear', visible: false },
      ],
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.User,
              value: (datum: Record<string, unknown>) =>
                formatVal(Number(datum?.rawQuota) || 0),
            },
          ],
          updateContent: (
            array: Array<{
              key: string
              value: string | number
              datum?: Record<string, unknown>
            }>
          ) => {
            for (let i = 0; i < array.length; i++) {
              const rawQuota = array[i].datum?.rawQuota
              const value =
                rawQuota === undefined ? array[i].value : Number(rawQuota)
              array[i].value = formatVal(Number(value) || 0)
            }
            return array
          },
        },
      },
      color: { specified: userColorMap },
      background: { fill: 'transparent' },
      animation: true,
    },
    spec_user_trend: {
      type: 'area',
      data: [{ id: 'userTrendData', values: trendValues }],
      xField: 'Time',
      yField: 'rawQuota',
      seriesField: 'User',
      stack: false,
      title: {
        visible: true,
        text: tt('User Consumption Trend'),
        subtext: `${tt('Total:')} ${formatVal(totalQuota)}`,
      },
      legends: { visible: true, selectMode: 'single' },
      axes: [
        { orient: 'bottom', type: 'band' },
        {
          orient: 'left',
          type: 'linear',
          label: {
            formatMethod: (value: number) => formatVal(value),
          },
        },
      ],
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.User,
              value: (datum: Record<string, unknown>) =>
                formatVal(Number(datum?.rawQuota) || 0),
            },
          ],
        },
        dimension: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.User,
              value: (datum: Record<string, unknown>) =>
                Number(datum?.rawQuota) || 0,
            },
          ],
          updateContent: (
            array: Array<{
              key: string
              value: string | number
            }>
          ) => {
            array.sort(
              (a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)
            )
            let sum = 0
            for (let i = 0; i < array.length; i++) {
              const v = Number(array[i].value) || 0
              sum += v
              array[i].value = formatVal(v)
            }
            array.unshift({
              key: tt('Total:'),
              value: formatVal(sum),
            })
            return array
          },
        },
      },
      area: {
        style: {
          fillOpacity: 0.15,
          curveType: 'monotone',
        },
      },
      line: {
        style: {
          lineWidth: 2,
          curveType: 'monotone',
        },
      },
      point: { visible: false },
      color: { specified: userColorMap },
      background: { fill: 'transparent' },
      animation: true,
    },
  }
}
