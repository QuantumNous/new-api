import type { ModelMonitoringStats } from '@/types/api'
import { Activity, BarChart3, CheckCircle, Zap } from 'lucide-react'
import { formatNumber } from '@/lib/formatters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface ModelMonitoringStatsProps {
  stats: ModelMonitoringStats
  loading?: boolean
  error?: string | null
}

export function ModelMonitoringStats({
  stats,
  loading,
  error,
}: ModelMonitoringStatsProps) {
  const cards = [
    {
      title: '模型总数',
      value: stats.total_models.toString(),
      description: '系统中的模型总数量',
      icon: <Zap className='text-muted-foreground h-4 w-4' />,
      trend: null,
    },
    {
      title: '活跃模型',
      value: stats.active_models.toString(),
      description: `${stats.total_models > 0 ? ((stats.active_models / stats.total_models) * 100).toFixed(1) : 0}% 的模型有调用`,
      icon: <Activity className='text-muted-foreground h-4 w-4' />,
      trend: null,
    },
    {
      title: '调用总次数',
      value: formatNumber(stats.total_requests),
      description: '所有模型的调用总数',
      icon: <BarChart3 className='text-muted-foreground h-4 w-4' />,
      trend: null,
    },
    {
      title: '平均成功率',
      value: `${stats.avg_success_rate.toFixed(1)}%`,
      description: '所有模型的平均成功率',
      icon: <CheckCircle className='text-muted-foreground h-4 w-4' />,
      trend: null,
    },
  ]

  if (loading) {
    return (
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <Skeleton className='h-4 w-1/2' />
              <Skeleton className='h-4 w-4 rounded-full' />
            </CardHeader>
            <CardContent>
              <Skeleton className='mb-2 h-8 w-3/4' />
              <Skeleton className='h-3 w-1/2' />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {cards.map((card, i) => (
          <Card key={i}>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                {card.title}
              </CardTitle>
              {card.icon}
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold text-red-500'>Error</div>
              <p className='text-muted-foreground text-xs'>{error}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      {cards.map((card, i) => (
        <Card key={i}>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>{card.title}</CardTitle>
            {card.icon}
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{card.value}</div>
            <p className='text-muted-foreground text-xs'>{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
