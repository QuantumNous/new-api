import { useMemo } from 'react'
import {
  PieChart as PieChartIcon,
  Coins,
  TrendingUp,
  Activity,
} from 'lucide-react'
import type { TimeGranularity } from '@/lib/time'
import type { QuotaDataItem } from '@/features/dashboard/api'
import { processChartData } from '@/features/dashboard/utils'
import { CardState } from '../ui/card-state'
import {
  QuotaDistributionChart,
  CallProportionChart,
  TopModelsChart,
  CallTrendChart,
  TotalCallsTrendChart,
} from './chart'

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

  const isEmpty = !data || data.length === 0

  // Loading state
  if (loading) {
    return (
      <div className='col-span-full space-y-4'>
        <CardState
          title={
            <span className='flex items-center gap-2'>
              <Coins className='h-5 w-5' />
              Quota Distribution
            </span>
          }
          height='h-96'
          loading={true}
        />

        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
          <CardState
            title={
              <span className='flex items-center gap-2'>
                <PieChartIcon className='h-5 w-5' />
                Call Proportion
              </span>
            }
            height='h-96'
            loading={true}
          />
          <CardState
            title={
              <span className='flex items-center gap-2'>
                <TrendingUp className='h-5 w-5' />
                Top Models
              </span>
            }
            height='h-96'
            loading={true}
          />
        </div>

        <CardState
          title={
            <span className='flex items-center gap-2'>
              <Activity className='h-5 w-5' />
              Call Trend
            </span>
          }
          height='h-96'
          loading={true}
        />

        <CardState
          title={
            <span className='flex items-center gap-2'>
              <TrendingUp className='h-5 w-5' />
              Total Calls Trend
            </span>
          }
          height='h-96'
          loading={true}
        />
      </div>
    )
  }

  // Empty state
  if (isEmpty) {
    return (
      <CardState
        title={
          <span className='flex items-center gap-2'>
            <PieChartIcon className='h-5 w-5' />
            Model Analytics
          </span>
        }
        height='h-96'
      >
        No data available for the selected time range
      </CardState>
    )
  }

  // Normal state - render charts
  return (
    <div className='col-span-full space-y-4'>
      {/* 消耗分布 */}
      <QuotaDistributionChart
        data={chartData.distributionData}
        uniqueModels={chartData.uniqueModels}
        chartConfig={chartData.chartConfig}
      />

      {/* 调用占比 和 模型排行 - 并排显示 */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <CallProportionChart
          data={chartData.pieData}
          chartConfig={chartData.chartConfig}
        />
        <TopModelsChart data={chartData.rankData} />
      </div>

      {/* 调用趋势 */}
      <CallTrendChart
        data={chartData.trendData}
        uniqueModels={chartData.uniqueModels}
        chartConfig={chartData.chartConfig}
      />

      {/* 全模型调用总量趋势 */}
      <TotalCallsTrendChart data={chartData.totalTrendData} />
    </div>
  )
}
