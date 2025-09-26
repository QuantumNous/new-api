import { useMemo } from 'react'
import type { ModelUsageData } from '@/types/api'
import { useTranslation } from 'react-i18next'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import { modelToColor } from '@/lib/colors'
import { formatValue } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface ModelUsageChartProps {
  data: ModelUsageData[]
  loading?: boolean
  error?: string | null
  title?: string
  description?: string
}

interface ChartDataPoint {
  name: string
  value: number
  quota: number
  tokens: number
  count: number
  percentage: number
  color: string
}

export function ModelUsageChart({
  data = [],
  loading = false,
  error = null,
  title,
  description,
}: ModelUsageChartProps) {
  const { t } = useTranslation()

  const defaultTitle = title || t('dashboard.model_usage.title')
  const defaultDescription =
    description || t('dashboard.model_usage.description')
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!data || data.length === 0) return []

    // 只取前12个模型，避免图表过于拥挤
    const topModels = data.slice(0, 12)

    return topModels.map((item) => ({
      name: item.model,
      value: item.quota,
      quota: item.quota,
      tokens: item.tokens,
      count: item.count,
      percentage: item.percentage,
      color: modelToColor(item.model),
    }))
  }, [data])

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className='bg-background border-border min-w-[200px] rounded-lg border p-3 shadow-lg'>
          <p className='mb-2 text-sm font-medium'>{data.name}</p>
          <div className='space-y-1 text-xs'>
            <p className='text-primary'>
              {t('dashboard.model_usage.quota')}:{' '}
              {formatValue(data.quota, 'quota')} ({data.percentage.toFixed(1)}%)
            </p>
            <p className='text-blue-600'>
              {t('dashboard.model_usage.tokens')}:{' '}
              {formatValue(data.tokens, 'tokens')}
            </p>
            <p className='text-green-600'>
              {t('dashboard.model_usage.requests')}:{' '}
              {formatValue(data.count, 'count')}
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  const CustomLegend = ({ payload }: any) => {
    if (!payload || payload.length === 0) return null

    return (
      <div className='mt-4 flex flex-wrap justify-center gap-2'>
        {payload.map((entry: any, index: number) => (
          <Badge
            key={index}
            variant='outline'
            className='text-xs'
            style={{ borderColor: entry.color }}
          >
            <div
              className='mr-1 h-2 w-2 rounded-full'
              style={{ backgroundColor: entry.color }}
            />
            {entry.value}
          </Badge>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{defaultTitle}</CardTitle>
          {defaultDescription && (
            <CardDescription>{defaultDescription}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <Skeleton className='h-[350px] w-full' />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{defaultTitle}</CardTitle>
          {defaultDescription && (
            <CardDescription>{defaultDescription}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className='text-muted-foreground flex h-[350px] items-center justify-center'>
            <div className='text-center'>
              <p className='text-sm font-medium'>
                {t('dashboard.model_usage.failed_to_load')}
              </p>
              <p className='mt-1 text-xs'>{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!chartData || chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{defaultTitle}</CardTitle>
          {defaultDescription && (
            <CardDescription>{defaultDescription}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className='text-muted-foreground flex h-[350px] items-center justify-center'>
            <div className='text-center'>
              <p className='text-sm font-medium'>
                {t('dashboard.model_usage.no_data')}
              </p>
              <p className='mt-1 text-xs'>
                {t('dashboard.model_usage.start_making_calls')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{defaultTitle}</CardTitle>
        {defaultDescription && (
          <CardDescription>{defaultDescription}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width='100%' height={350}>
          <PieChart>
            <Pie
              data={chartData}
              cx='50%'
              cy='50%'
              labelLine={false}
              outerRadius={100}
              fill='#8884d8'
              dataKey='value'
              label={({ percentage }) => `${percentage.toFixed(1)}%`}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
