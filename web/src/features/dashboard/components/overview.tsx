import { useMemo } from 'react'
import type { TrendDataPoint } from '@/types/api'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { formatChartTimestamp, formatValue } from '@/lib/formatters'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface OverviewProps {
  data: TrendDataPoint[]
  loading?: boolean
  error?: string | null
  title?: string
  description?: string
}

interface ChartDataPoint {
  name: string
  quota: number
  tokens: number
  count: number
  timestamp: number
}

export function Overview({
  data = [],
  loading = false,
  error = null,
  title,
  description,
}: OverviewProps) {
  const { t } = useTranslation()

  const defaultTitle = title || t('dashboard.overview.title')
  const defaultDescription = description || t('dashboard.overview.description')
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!data || data.length === 0) return []

    return data
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((item) => ({
        name: formatChartTimestamp(item.timestamp),
        quota: item.quota,
        tokens: item.tokens,
        count: item.count,
        timestamp: item.timestamp,
      }))
  }, [data])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className='bg-background border-border rounded-lg border p-3 shadow-lg'>
          <p className='mb-2 text-sm font-medium'>{label}</p>
          <div className='space-y-1 text-xs'>
            <p className='text-primary'>
              {t('dashboard.overview.quota')}:{' '}
              {formatValue(data.quota, 'quota')}
            </p>
            <p className='text-blue-600'>
              {t('dashboard.overview.tokens')}:{' '}
              {formatValue(data.tokens, 'tokens')}
            </p>
            <p className='text-green-600'>
              {t('dashboard.overview.requests')}:{' '}
              {formatValue(data.count, 'count')}
            </p>
          </div>
        </div>
      )
    }
    return null
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
                {t('dashboard.overview.failed_to_load')}
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
                {t('dashboard.overview.no_data_available')}
              </p>
              <p className='mt-1 text-xs'>
                {t('dashboard.overview.try_adjusting_time_range')}
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
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis
              dataKey='name'
              stroke='hsl(var(--muted-foreground))'
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke='hsl(var(--muted-foreground))'
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatValue(value, 'quota')}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey='quota'
              fill='hsl(var(--primary))'
              radius={[4, 4, 0, 0]}
              name='Quota'
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
