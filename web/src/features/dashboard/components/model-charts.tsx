import { useMemo, useState } from 'react'
import { PieChart as PieChartIcon } from 'lucide-react'
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { getChartColor } from '@/lib/colors'
import { formatCurrencyUSD, formatCompactNumber } from '@/lib/format'
import { formatChartTime, type TimeGranularity } from '@/lib/time'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { QuotaDataItem } from '@/features/dashboard/api'
import { CHART_STYLES } from '@/features/dashboard/constants'
import { CardState } from './ui/card-state'

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
  const [activeTab, setActiveTab] = useState('distribution')

  // 统一的数据聚合和转换逻辑
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        uniqueModels: [],
        distributionData: [],
        trendData: [],
        pieData: [],
        rankData: [],
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

    return {
      uniqueModels,
      distributionData,
      trendData,
      pieData,
      rankData,
    }
  }, [data, timeGranularity])

  if (loading) {
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
        Loading charts...
      </CardState>
    )
  }

  if (!data || data.length === 0) {
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

  return (
    <Card className='col-span-full'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <PieChartIcon className='h-5 w-5' />
          Model Analytics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className='bg-muted/50 grid w-full grid-cols-4'>
            <TabsTrigger value='distribution'>
              <span className='hidden sm:inline'>Quota Distribution</span>
              <span className='sm:hidden'>Distribution</span>
            </TabsTrigger>
            <TabsTrigger value='trend'>
              <span className='hidden sm:inline'>Call Trend</span>
              <span className='sm:hidden'>Trend</span>
            </TabsTrigger>
            <TabsTrigger value='proportion'>
              <span className='hidden sm:inline'>Call Proportion</span>
              <span className='sm:hidden'>Proportion</span>
            </TabsTrigger>
            <TabsTrigger value='ranking'>
              <span className='hidden sm:inline'>Top Models</span>
              <span className='sm:hidden'>Ranking</span>
            </TabsTrigger>
          </TabsList>

          {/* 消耗分布 - 堆叠柱状图 */}
          <TabsContent value='distribution' className='mt-6'>
            <div className='h-96'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart
                  data={chartData.distributionData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    {chartData.uniqueModels.map((model, index) => (
                      <linearGradient
                        key={`gradient-${model}`}
                        id={`colorGradient${index}`}
                        x1='0'
                        y1='0'
                        x2='0'
                        y2='1'
                      >
                        <stop
                          offset='5%'
                          stopColor={getChartColor(index)}
                          stopOpacity={0.9}
                        />
                        <stop
                          offset='95%'
                          stopColor={getChartColor(index)}
                          stopOpacity={0.7}
                        />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid {...CHART_STYLES.grid} />
                  <XAxis
                    dataKey='time'
                    tick={CHART_STYLES.axis.tick}
                    stroke={CHART_STYLES.axis.stroke}
                  />
                  <YAxis
                    tick={CHART_STYLES.axis.tick}
                    stroke={CHART_STYLES.axis.stroke}
                  />
                  <Tooltip
                    {...CHART_STYLES.tooltip}
                    formatter={(value: number) => [
                      formatCurrencyUSD(value),
                      'Quota',
                    ]}
                  />
                  <Legend {...CHART_STYLES.legend} />
                  {chartData.uniqueModels.map((model, index) => (
                    <Bar
                      key={model}
                      dataKey={model}
                      stackId='a'
                      fill={`url(#colorGradient${index})`}
                      radius={
                        index === chartData.uniqueModels.length - 1
                          ? [4, 4, 0, 0]
                          : 0
                      }
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* 调用趋势 - 面积曲线图 */}
          <TabsContent value='trend' className='mt-6'>
            <div className='h-96'>
              <ResponsiveContainer width='100%' height='100%'>
                <AreaChart
                  data={chartData.trendData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    {chartData.uniqueModels.map((model, index) => (
                      <linearGradient
                        key={`area-gradient-${model}`}
                        id={`areaGradient${index}`}
                        x1='0'
                        y1='0'
                        x2='0'
                        y2='1'
                      >
                        <stop
                          offset='5%'
                          stopColor={getChartColor(index)}
                          stopOpacity={0.8}
                        />
                        <stop
                          offset='95%'
                          stopColor={getChartColor(index)}
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid {...CHART_STYLES.grid} />
                  <XAxis
                    dataKey='time'
                    tick={CHART_STYLES.axis.tick}
                    stroke={CHART_STYLES.axis.stroke}
                  />
                  <YAxis
                    tick={CHART_STYLES.axis.tick}
                    stroke={CHART_STYLES.axis.stroke}
                  />
                  <Tooltip
                    {...CHART_STYLES.tooltip}
                    formatter={(value: number) => formatCompactNumber(value)}
                  />
                  <Legend {...CHART_STYLES.legend} />
                  {chartData.uniqueModels.map((model, index) => (
                    <Area
                      key={model}
                      type='monotone'
                      dataKey={model}
                      name={model}
                      stroke={getChartColor(index)}
                      strokeWidth={2}
                      fill={`url(#areaGradient${index})`}
                      fillOpacity={1}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* 调用占比 - 饼图 */}
          <TabsContent value='proportion' className='mt-6'>
            <div className='h-96'>
              <ResponsiveContainer width='100%' height='100%'>
                <PieChart>
                  <Pie
                    data={chartData.pieData}
                    cx='50%'
                    cy='50%'
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${((percent || 0) * 100).toFixed(1)}%`
                    }
                    outerRadius={120}
                    innerRadius={60}
                    fill='#8884d8'
                    dataKey='value'
                    paddingAngle={2}
                  >
                    {chartData.pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={getChartColor(index)} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={CHART_STYLES.tooltip.contentStyle}
                    formatter={(value: number) => formatCompactNumber(value)}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* 模型排行 - 横向条形图 */}
          <TabsContent value='ranking' className='mt-6'>
            <div className='h-96'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart
                  data={chartData.rankData}
                  layout='vertical'
                  margin={{ top: 10, right: 30, left: 20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id='rankGradient'
                      x1='0'
                      y1='0'
                      x2='1'
                      y2='0'
                    >
                      <stop
                        offset='5%'
                        stopColor={getChartColor(0)}
                        stopOpacity={0.9}
                      />
                      <stop
                        offset='95%'
                        stopColor={getChartColor(0)}
                        stopOpacity={0.5}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...CHART_STYLES.grid} />
                  <XAxis
                    type='number'
                    tick={CHART_STYLES.axis.tick}
                    stroke={CHART_STYLES.axis.stroke}
                  />
                  <YAxis
                    type='category'
                    dataKey='model'
                    tick={CHART_STYLES.axis.tick}
                    stroke={CHART_STYLES.axis.stroke}
                    width={150}
                  />
                  <Tooltip
                    {...CHART_STYLES.tooltip}
                    formatter={(value: number) => [
                      formatCompactNumber(value),
                      'Calls',
                    ]}
                  />
                  <Legend {...CHART_STYLES.legend} />
                  <Bar
                    dataKey='count'
                    name='Calls'
                    fill='url(#rankGradient)'
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
