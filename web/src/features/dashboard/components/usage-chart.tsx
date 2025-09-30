import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'
import { formatCurrencyUSD } from '@/lib/format'
import { formatDate, toStartOfDay, computeTimeRange } from '@/lib/time'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getUserQuotaDates } from '@/features/dashboard/api'
import { buildQueryParams } from '@/features/dashboard/utils'

export interface UsageChartFilters {
  start_timestamp?: Date
  end_timestamp?: Date
  model_name?: string
  token_name?: string
}

export function UsageChart({ filters }: { filters?: UsageChartFilters }) {
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    let mounted = true
    const timeRange = computeTimeRange(
      14,
      filters?.start_timestamp,
      filters?.end_timestamp,
      true // 使用每天的开始时间
    )
    const params = buildQueryParams(timeRange, filters)

    getUserQuotaDates(params)
      .then((res) => {
        if (!mounted) return
        const items = (res?.data || []) as any[]
        // group by created_at day: sum quota
        const byDay = new Map<number, number>()
        for (const it of items) {
          const day = toStartOfDay(Number(it.created_at))
          const prev = byDay.get(day) || 0
          byDay.set(day, prev + (Number(it.quota) || 0))
        }
        const arr = Array.from(byDay.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([ts, quota]) => ({ name: formatDate(ts), total: quota }))
        setData(arr)
      })
      .catch(() => setData([]))
    return () => {
      mounted = false
    }
  }, [filters])

  return (
    <Card className='col-span-1 lg:col-span-4'>
      <CardHeader>
        <CardTitle>Usage</CardTitle>
      </CardHeader>
      <CardContent className='ps-2'>
        <div className='h-[350px]'>
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart data={data}>
              <XAxis
                dataKey='name'
                stroke='#888888'
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke='#888888'
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(v: any) => formatCurrencyUSD(Number(v) / 100)}
              />
              <Legend />
              <Bar
                dataKey='total'
                name='Quota (¢)'
                fill='currentColor'
                radius={[4, 4, 0, 0]}
                className='fill-primary'
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
