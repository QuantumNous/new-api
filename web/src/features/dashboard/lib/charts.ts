import { getChartColor } from '@/lib/colors'
import { formatChartTime, type TimeGranularity } from '@/lib/time'
import { sanitizeCssVariableName } from '@/lib/utils'
import type { ChartConfig } from '@/components/ui/chart'
import type { QuotaDataItem } from '@/features/dashboard/types'
import type { ProcessedChartData } from '@/features/dashboard/types'

/**
 * 处理和聚合图表数据
 */
export function processChartData(
  data: QuotaDataItem[],
  timeGranularity: TimeGranularity = 'day'
): ProcessedChartData {
  if (!data || data.length === 0) {
    return {
      uniqueModels: [],
      distributionData: [],
      trendData: [],
      pieData: [],
      rankData: [],
      totalTrendData: [],
      chartConfig: {} as ChartConfig,
    }
  }

  // 按时间和模型聚合所有指标
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

    // 按时间和模型聚合
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

    // 总计
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

  const uniqueModels = Array.from(modelTotalsMap.keys()).sort()
  const sortedTimes = Array.from(timeModelMap.keys()).sort()

  // 生成 chart config
  const chartConfig = uniqueModels.reduce<ChartConfig>(
    (config, model, index) => {
      config[model] = {
        label: model,
        color: getChartColor(index),
      }
      return config
    },
    {}
  )

  // 生成各图表所需的数据格式
  const distributionData = sortedTimes.map((time) => {
    const modelData = timeModelMap.get(time)!
    const dataPoint: any = { time }
    uniqueModels.forEach((model) => {
      const stats = modelData.get(model) || { quota: 0, count: 0, tokens: 0 }
      dataPoint[model] = stats.quota / 100 // 转换为美元
    })
    return dataPoint
  })

  const trendData = sortedTimes.map((time) => {
    const modelData = timeModelMap.get(time)!
    const dataPoint: any = { time }
    uniqueModels.forEach((model) => {
      const stats = modelData.get(model) || { quota: 0, count: 0, tokens: 0 }
      dataPoint[model] = stats.count
    })
    return dataPoint
  })

  const pieData = Array.from(modelTotalsMap.entries())
    .map(([model, stats]) => ({
      name: model,
      value: stats.count,
      fill: `var(--color-${sanitizeCssVariableName(model)})`,
    }))
    .sort((a, b) => b.value - a.value)

  const rankData = Array.from(modelTotalsMap.entries())
    .map(([model, stats]) => ({
      model,
      count: stats.count,
      quota: stats.quota / 100,
      tokens: stats.tokens,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // 全模型调用总量趋势数据
  const totalTrendData = sortedTimes.map((time) => {
    const modelData = timeModelMap.get(time)!
    let totalCalls = 0
    let totalQuota = 0
    modelData.forEach((stats) => {
      totalCalls += stats.count
      totalQuota += stats.quota
    })
    return {
      time,
      calls: totalCalls,
      quota: totalQuota / 100,
    }
  })

  return {
    uniqueModels,
    distributionData,
    trendData,
    pieData,
    rankData,
    totalTrendData,
    chartConfig,
  }
}
