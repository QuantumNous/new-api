import { dataScheme as vchartDefaultDataScheme } from '@visactor/vchart/esm/theme/color-scheme/builtin/default'
import { getCurrencyDisplay } from '@/lib/currency'
import { formatChartTime, type TimeGranularity } from '@/lib/time'
import { MAX_CHART_TREND_POINTS } from '@/features/dashboard/constants'
import type {
  QuotaDataItem,
  ProcessedChartData,
  ProcessedModelTokenChartData,
  ProcessedUserChartData,
} from '@/features/dashboard/types'

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

const THEME_CHART_COLOR_VARIABLES = [
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
] as const

const VIBRANT_TOKEN_COLORS = [
  '#6366F1',
  '#F59E0B',
  '#10B981',
  '#EC4899',
  '#8B5CF6',
  '#06B6D4',
  '#F97316',
  '#14B8A6',
  '#E11D48',
  '#3B82F6',
  '#A855F7',
  '#84CC16',
  '#0EA5E9',
  '#D946EF',
  '#22C55E',
]

type HSL = { h: number; s: number; l: number }

function parseColorToHSL(color: string): HSL {
  const trim = (s: string) => s.trim()
  const c = String(color).trim().toLowerCase()
  if (!c || c === 'transparent' || c === 'none') return { h: 222, s: 89, l: 55 }

  if (c.startsWith('#')) {
    const hex = c.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    if (!isNaN(r + g + b)) return rgbToHsl(r, g, b)
  }

  const rgbMatch = c.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (rgbMatch) {
    return rgbToHsl(parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3]))
  }

  const hslMatch = c.match(/^hsla?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/)
  if (hslMatch) {
    return { h: parseFloat(hslMatch[1]), s: parseFloat(hslMatch[2]), l: parseFloat(hslMatch[3]) }
  }

  return { h: 222, s: 89, l: 55 }
}

function rgbToHsl(r: number, g: number, b: number): HSL {
  const r1 = r / 255, g1 = g / 255, b1 = b / 255
  const max = Math.max(r1, g1, b1), min = Math.min(r1, g1, b1)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r1) h = ((g1 - b1) / d + (g1 < b1 ? 6 : 0)) * 60
  else if (max === g1) h = ((b1 - r1) / d + 2) * 60
  else h = ((r1 - g1) / d + 4) * 60
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function hslToString(hsl: HSL): string {
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`
}

function generateTokenColorVariants(baseColor: string): [string, string, string] {
  const hsl = parseColorToHSL(baseColor)
  const isGray = hsl.s < 15
  const cacheHit: HSL = isGray
    ? { h: hsl.h, s: 25, l: Math.min(85, hsl.l + 30) }
    : { h: hsl.h, s: Math.max(20, hsl.s - 15), l: Math.min(88, hsl.l + 22) }
  const cacheMiss: HSL = isGray
    ? { h: hsl.h, s: 35, l: Math.max(30, hsl.l) }
    : { h: hsl.h, s: hsl.s, l: hsl.l }
  const output: HSL = isGray
    ? { h: hsl.h, s: 40, l: Math.max(20, hsl.l - 15) }
    : { h: hsl.h, s: Math.min(100, hsl.s + 10), l: Math.max(18, hsl.l - 12) }
  return [hslToString(cacheHit), hslToString(cacheMiss), hslToString(output)]
}

function getThemeChartColors(themeKey?: string): string[] {
  if (typeof document === 'undefined') return []
  void themeKey

  const bodyStyle = window.getComputedStyle(document.body)
  const rootStyle = window.getComputedStyle(document.documentElement)

  return THEME_CHART_COLOR_VARIABLES.map((name) => {
    return (
      bodyStyle.getPropertyValue(name) || rootStyle.getPropertyValue(name)
    ).trim()
  }).filter(Boolean)
}

function getVChartDefaultColors(domainLength: number, themeKey?: string) {
  const themeColors = getThemeChartColors(themeKey)
  if (themeColors.length > 0) {
    return Array.from(
      { length: Math.max(domainLength, themeColors.length) },
      (_, index) => themeColors[index % themeColors.length]
    )
  }

  const scheme =
    vchartDefaultDataScheme.find(
      (item) => !item.maxDomainLength || domainLength <= item.maxDomainLength
    ) ?? vchartDefaultDataScheme[vchartDefaultDataScheme.length - 1]

  return scheme.scheme
}

function renderQuotaCompat(rawQuota: number, digits = 4): string {
  const { config, meta } = getCurrencyDisplay()
  if (meta.kind === 'tokens') return rawQuota.toLocaleString()
  const usd = rawQuota / config.quotaPerUnit
  const rate = 'exchangeRate' in meta ? meta.exchangeRate : 1
  const symbol = 'symbol' in meta ? meta.symbol : '$'
  const value = usd * rate
  const fixed = value.toFixed(digits)
  if (parseFloat(fixed) === 0 && rawQuota > 0 && value > 0) {
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
  themeKey?: string
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
        type: 'line',
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
    if (!timeModelMap.has(timeKey)) {
      timeModelMap.set(timeKey, new Map())
    }
    const modelMap = timeModelMap.get(timeKey)!
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

  const allModels = Array.from(modelTotalsMap.keys())
  const sortedTimes = Array.from(timeModelMap.keys()).sort()
  const sortedModels = [...allModels].sort()
  const modelColorDomain = Array.from(new Set([...sortedModels, otherLabel]))
  const modelColorRange = getVChartDefaultColors(
    modelColorDomain.length,
    themeKey
  )
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
    const intervalSec =
      timeGranularity === 'week'
        ? 604800
        : timeGranularity === 'day'
          ? 86400
          : 3600
    const padded = Array.from({ length: MAX_TREND_POINTS }, (_, i) =>
      formatChartTime(
        lastTime - (MAX_TREND_POINTS - 1 - i) * intervalSec,
        timeGranularity
      )
    )
    return padded
  }
  const chartTimes = fillTimePoints(sortedTimes)

  const totalTimes = Array.from(modelTotalsMap.values()).reduce(
    (sum, x) => sum + (Number(x.count) || 0),
    0
  )
  const totalQuotaRaw = Array.from(modelTotalsMap.values()).reduce(
    (sum, x) => sum + (Number(x.quota) || 0),
    0
  )

  // Pie chart (model call count proportion)
  const pieValues = Array.from(modelTotalsMap.entries())
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
  const rankedQuotaModels = Array.from(modelTotalsMap.entries())
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
  const rankedTrendModels = Array.from(modelTotalsMap.entries())
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
  const allRankValues = Array.from(modelTotalsMap.entries())
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
        style: { cornerRadius: 10 },
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

const USER_COLOR_FALLBACKS = [
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
  limit = 10,
  themeKey?: string
): ProcessedUserChartData {
  const tt: TFunction = t ?? ((x) => x)
  const { config } = getCurrencyDisplay()
  const quotaPerUnit = config.quotaPerUnit
  const themeUserColors = getThemeChartColors(themeKey)
  const userColorRange =
    themeUserColors.length > 0
      ? Array.from(
          { length: Math.max(limit, themeUserColors.length) },
          (_, index) => themeUserColors[index % themeUserColors.length]
        )
      : USER_COLOR_FALLBACKS

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
      color: { type: 'ordinal', range: userColorRange },
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
      color: { type: 'ordinal', range: userColorRange },
      point: { visible: false },
      background: { fill: 'transparent' },
    },
    spec_user_token: {
      type: 'bar',
      data: [{ id: 'userTokenData', values: [] }],
      xField: 'Time',
      yField: 'Tokens',
      seriesField: 'Series',
      stack: true,
      title: {
        visible: true,
        text: tt('User Token Trend'),
        subtext: tt('No data available'),
      },
      legends: { visible: false },
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

  const sorted = Array.from(userQuotaTotal.entries()).sort(
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
      acc[user] = userColorRange[i % userColorRange.length]
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
    if (!timeUserMap.has(timeKey)) timeUserMap.set(timeKey, new Map())
    const map = timeUserMap.get(timeKey)!
    map.set(user, (map.get(user) || 0) + (Number(item.quota) || 0))
  })

  const sortedTimePoints = Array.from(allTimePoints).sort()
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

  const formatInt = (value: number) =>
    Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)

  const cacheHitLabel = tt('Input (Cache Hit)')
  const cacheMissLabel = tt('Input (Cache Miss)')
  const outputTokensLabel = tt('Output Tokens')

  const tokenTimeUserMap = new Map<string, Map<string, { cacheHit: number; cacheMiss: number; output: number; total: number }>>()
  data.forEach((item) => {
    const ts = Number(item.created_at)
    const timeKey = formatChartTime(ts, timeGranularity)
    const user = item.username || 'unknown'
    if (!topUserSet.has(user)) return
    if (!tokenTimeUserMap.has(timeKey)) tokenTimeUserMap.set(timeKey, new Map())
    const map = tokenTimeUserMap.get(timeKey)!
    const prev = map.get(user) || { cacheHit: 0, cacheMiss: 0, output: 0, total: 0 }
    const promptTokens = Number(item.prompt_tokens) || 0
    const completionTokens = Number(item.completion_tokens) || 0
    const cacheHit = Number(item.cache_tokens) || 0
    const tokenUsed = Number(item.token_used) || 0

    let cacheMissVal: number
    let outputVal: number
    if (promptTokens > 0 || completionTokens > 0) {
      cacheMissVal = Math.max(0, promptTokens - cacheHit)
      outputVal = completionTokens
    } else {
      const cacheCreation = Number(item.cache_creation_tokens) || 0
      cacheMissVal = cacheCreation
      outputVal = Math.max(0, tokenUsed - cacheHit - cacheCreation)
    }

    map.set(user, {
      cacheHit: prev.cacheHit + cacheHit,
      cacheMiss: prev.cacheMiss + cacheMissVal,
      output: prev.output + outputVal,
      total: prev.total + tokenUsed,
    })
  })

  const tokenSeries: Array<{ Time: string; Series: string; Tokens: number; User: string }> = []
  sortedTimePoints.forEach((time) => {
    topUsers.forEach((user) => {
      const stats = tokenTimeUserMap.get(time)?.get(user) || { cacheHit: 0, cacheMiss: 0, output: 0, total: 0 }
      if (stats.cacheHit > 0) tokenSeries.push({ Time: time, Series: `${user} - ${cacheHitLabel}`, Tokens: stats.cacheHit, User: user })
      if (stats.cacheMiss > 0) tokenSeries.push({ Time: time, Series: `${user} - ${cacheMissLabel}`, Tokens: stats.cacheMiss, User: user })
      if (stats.output > 0) tokenSeries.push({ Time: time, Series: `${user} - ${outputTokensLabel}`, Tokens: stats.output, User: user })
    })
  })

  const userTokenTotals = new Map<string, number>()
  data.forEach((item) => {
    const user = item.username || 'unknown'
    if (!topUserSet.has(user)) return
    userTokenTotals.set(user, (userTokenTotals.get(user) || 0) + (Number(item.token_used) || 0))
  })
  const sortedUsersByTokens = Array.from(userTokenTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([u]) => u)

  const tokenDomain: string[] = []
  const tokenColorRange: string[] = []
  sortedUsersByTokens.forEach((user, i) => {
    const baseColor = VIBRANT_TOKEN_COLORS[i % VIBRANT_TOKEN_COLORS.length]
    const [light, medium, dark] = generateTokenColorVariants(baseColor)
    tokenDomain.push(`${user} - ${cacheHitLabel}`, `${user} - ${cacheMissLabel}`, `${user} - ${outputTokensLabel}`)
    tokenColorRange.push(light, medium, dark)
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
    spec_user_token: {
      type: 'bar',
      data: [{ id: 'userTokenData', values: tokenSeries }],
      xField: 'Time',
      yField: 'Tokens',
      seriesField: 'Series',
      stack: true,
      title: {
        visible: true,
        text: tt('User Token Trend'),
      },
      legends: { visible: true, selectMode: 'single' },
      bar: {
        state: { hover: { stroke: '#000', lineWidth: 1 } },
      },
      color: {
        type: 'ordinal',
        domain: tokenDomain,
        range: tokenColorRange,
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.Series,
              value: (datum: Record<string, unknown>) => formatInt(Number(datum?.Tokens) || 0),
            },
          ],
        },
      },
      background: { fill: 'transparent' },
      animation: true,
    },
  }
}

export function processModelTokenChartData(
  data: QuotaDataItem[],
  timeGranularity: TimeGranularity = 'day',
  t?: TFunction,
  themeKey?: string
): ProcessedModelTokenChartData {
  const tt: TFunction = t ?? ((x) => x)
  const formatInt = (value: number) =>
    Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)

  const cacheHitLabel = tt('Input (Cache Hit)')
  const cacheMissLabel = tt('Input (Cache Miss)')
  const outputTokensLabel = tt('Output Tokens')

  const emptyResult: ProcessedModelTokenChartData = {
    spec: {
      type: 'bar',
      data: [{ id: 'modelTokenData', values: [] }],
      xField: 'Time',
      yField: 'Tokens',
      seriesField: 'Series',
      stack: true,
      title: {
        visible: true,
        text: tt('Model Token Trend'),
        subtext: tt('No data available'),
      },
      legends: { visible: false },
      background: { fill: 'transparent' },
    },
    totalTokensDisplay: '0',
  }

  if (!data || data.length === 0) return emptyResult

  const timeModelTokenMap = new Map<
    string,
    Map<string, { cacheHit: number; cacheMiss: number; output: number; total: number }>
  >()

  data.forEach((item) => {
    const timestamp = Number(item.created_at)
    const timeKey = formatChartTime(timestamp, timeGranularity)
    const model = item.model_name || 'Unknown'

    if (!timeModelTokenMap.has(timeKey)) {
      timeModelTokenMap.set(timeKey, new Map())
    }
    const modelMap = timeModelTokenMap.get(timeKey)!
    const prev = modelMap.get(model) || { cacheHit: 0, cacheMiss: 0, output: 0, total: 0 }
    const promptTokens = Number(item.prompt_tokens) || 0
    const completionTokens = Number(item.completion_tokens) || 0
    const cacheHit = Number(item.cache_tokens) || 0
    const tokenUsed = Number(item.token_used) || 0

    let cacheMissVal: number
    let outputVal: number
    if (promptTokens > 0 || completionTokens > 0) {
      // Use actual prompt/completion breakdown
      cacheMissVal = Math.max(0, promptTokens - cacheHit)
      outputVal = completionTokens
    } else {
      // Fallback for historical data: use cache_creation as cache miss proxy, rest as output
      const cacheCreation = Number(item.cache_creation_tokens) || 0
      cacheMissVal = cacheCreation
      outputVal = Math.max(0, tokenUsed - cacheHit - cacheCreation)
    }

    modelMap.set(model, {
      cacheHit: prev.cacheHit + cacheHit,
      cacheMiss: prev.cacheMiss + cacheMissVal,
      output: prev.output + outputVal,
      total: prev.total + tokenUsed,
    })
  })

  const sortedTimes = Array.from(timeModelTokenMap.keys()).sort()

  const MAX_TREND_POINTS = MAX_CHART_TREND_POINTS
  const fillTimePoints = (times: string[]) => {
    if (times.length >= MAX_TREND_POINTS) return times
    const lastTime = Math.max(
      ...data.map((item) => Number(item.created_at) || 0)
    )
    const intervalSec =
      timeGranularity === 'week'
        ? 604800
        : timeGranularity === 'day'
          ? 86400
          : 3600
    return Array.from({ length: MAX_TREND_POINTS }, (_, i) =>
      formatChartTime(
        lastTime - (MAX_TREND_POINTS - 1 - i) * intervalSec,
        timeGranularity
      )
    )
  }
  const chartTimes = fillTimePoints(sortedTimes)

  const modelTokenTotals = new Map<string, number>()
  data.forEach((item) => {
    const model = item.model_name || 'Unknown'
    modelTokenTotals.set(
      model,
      (modelTokenTotals.get(model) || 0) + (Number(item.token_used) || 0)
    )
  })

  const sortedModels = Array.from(modelTokenTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([model]) => model)

  const MAX_MODELS = 15
  const topModels = new Set(sortedModels.slice(0, MAX_MODELS))
  const otherLabel = tt('Other')

  const tokenDomain: string[] = []
  const tokenColorRange: string[] = []

  sortedModels.forEach((model, i) => {
    if (!topModels.has(model)) return
    const baseColor = VIBRANT_TOKEN_COLORS[i % VIBRANT_TOKEN_COLORS.length]
    const [light, medium, dark] = generateTokenColorVariants(baseColor)
    tokenDomain.push(`${model} - ${cacheHitLabel}`, `${model} - ${cacheMissLabel}`, `${model} - ${outputTokensLabel}`)
    tokenColorRange.push(light, medium, dark)
  })

  if (topModels.size < sortedModels.length) {
    const otherBase = VIBRANT_TOKEN_COLORS[sortedModels.filter((m) => topModels.has(m)).length % VIBRANT_TOKEN_COLORS.length]
    const [light, medium, dark] = generateTokenColorVariants(otherBase)
    tokenDomain.push(`${otherLabel} - ${cacheHitLabel}`, `${otherLabel} - ${cacheMissLabel}`, `${otherLabel} - ${outputTokensLabel}`)
    tokenColorRange.push(light, medium, dark)
  }

  const tokenSeries: Array<{ Time: string; Series: string; Tokens: number; Model: string }> = []

  chartTimes.forEach((time) => {
    const modelMap = timeModelTokenMap.get(time)
    const sortedTopModels = sortedModels.filter((m) => topModels.has(m))

    const otherBuckets = { cacheHit: 0, cacheMiss: 0, output: 0, total: 0 }
    if (topModels.size < sortedModels.length) {
      sortedModels.forEach((model) => {
        if (topModels.has(model)) return
        const stats = modelMap?.get(model)
        if (!stats) return
        otherBuckets.cacheHit += stats.cacheHit
        otherBuckets.cacheMiss += stats.cacheMiss
        otherBuckets.output += stats.output
        otherBuckets.total += stats.total
      })
      if (otherBuckets.total > 0) {
        if (otherBuckets.cacheHit > 0) tokenSeries.push({ Time: time, Series: `${otherLabel} - ${cacheHitLabel}`, Tokens: otherBuckets.cacheHit, Model: otherLabel })
        if (otherBuckets.cacheMiss > 0) tokenSeries.push({ Time: time, Series: `${otherLabel} - ${cacheMissLabel}`, Tokens: otherBuckets.cacheMiss, Model: otherLabel })
        if (otherBuckets.output > 0) tokenSeries.push({ Time: time, Series: `${otherLabel} - ${outputTokensLabel}`, Tokens: otherBuckets.output, Model: otherLabel })
      }
    }

    sortedTopModels.forEach((model) => {
      const stats = modelMap?.get(model) || { cacheHit: 0, cacheMiss: 0, output: 0, total: 0 }
      if (stats.cacheHit > 0) tokenSeries.push({ Time: time, Series: `${model} - ${cacheHitLabel}`, Tokens: stats.cacheHit, Model: model })
      if (stats.cacheMiss > 0) tokenSeries.push({ Time: time, Series: `${model} - ${cacheMissLabel}`, Tokens: stats.cacheMiss, Model: model })
      if (stats.output > 0) tokenSeries.push({ Time: time, Series: `${model} - ${outputTokensLabel}`, Tokens: stats.output, Model: model })
    })
  })

  const totalTokens = Array.from(modelTokenTotals.values()).reduce((sum, v) => sum + v, 0)

  return {
    spec: {
      type: 'bar',
      data: [{ id: 'modelTokenData', values: tokenSeries }],
      xField: 'Time',
      yField: 'Tokens',
      seriesField: 'Series',
      stack: true,
      legends: { visible: true, selectMode: 'single' },
      bar: {
        state: { hover: { stroke: '#000', lineWidth: 1 } },
      },
      color: {
        type: 'ordinal',
        domain: tokenDomain,
        range: tokenColorRange,
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.Series,
              value: (datum: Record<string, unknown>) => formatInt(Number(datum?.Tokens) || 0),
            },
          ],
        },
      },
      background: { fill: 'transparent' },
      animation: true,
    },
    totalTokensDisplay: formatInt(totalTokens),
  }
}
