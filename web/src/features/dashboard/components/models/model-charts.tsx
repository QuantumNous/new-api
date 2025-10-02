import { useMemo } from 'react'
import type { TimeGranularity } from '@/lib/time'
import { processChartData } from '@/features/dashboard/lib'
import type { QuotaDataItem } from '@/features/dashboard/types'
import {
  QuotaDistributionChart,
  CallProportionChart,
  TopModelsChart,
  CallTrendChart,
  TotalCallsTrendChart,
} from './charts'

interface ModelChartsProps {
  data: QuotaDataItem[]
  loading?: boolean
  timeGranularity?: TimeGranularity
}

export function ModelCharts({
  data,
  loading = false,
  timeGranularity = 'day',
}: ModelChartsProps) {
  // 统一的数据聚合和转换逻辑
  const chartData = useMemo(
    () => processChartData(data, timeGranularity),
    [data, timeGranularity]
  )

  return (
    <div className='col-span-full space-y-4'>
      {/* 消耗分布 */}
      <QuotaDistributionChart
        data={chartData.distributionData}
        uniqueModels={chartData.uniqueModels}
        chartConfig={chartData.chartConfig}
        loading={loading}
      />

      {/* 调用占比 和 模型排行 - 并排显示 */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <CallProportionChart
          data={chartData.pieData}
          chartConfig={chartData.chartConfig}
          loading={loading}
        />
        <TopModelsChart data={chartData.rankData} loading={loading} />
      </div>

      {/* 调用趋势 */}
      <CallTrendChart
        data={chartData.trendData}
        uniqueModels={chartData.uniqueModels}
        chartConfig={chartData.chartConfig}
        loading={loading}
      />

      {/* 全模型调用总量趋势 */}
      <TotalCallsTrendChart data={chartData.totalTrendData} loading={loading} />
    </div>
  )
}
