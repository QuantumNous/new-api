import type { DashboardStats } from '@/types/api'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Users,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface StatsCardsProps {
  stats: DashboardStats
  loading?: boolean
  error?: string | null
  className?: string
}

interface StatCardProps {
  title: string
  value: string
  description?: string
  icon: React.ReactNode
  trend?: {
    value: number
    isPositive: boolean
    period: string
  }
  loading?: boolean
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`
  } else {
    return `$${value.toFixed(2)}`
  }
}

const formatNumber = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  } else {
    return value.toString()
  }
}

function StatCard({
  title,
  value,
  description,
  icon,
  trend,
  loading,
}: StatCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <Skeleton className='h-4 w-24' />
          <Skeleton className='h-4 w-4' />
        </CardHeader>
        <CardContent>
          <Skeleton className='mb-2 h-8 w-20' />
          <Skeleton className='h-3 w-32' />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        <div className='text-muted-foreground'>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{value}</div>
        {description && (
          <p className='text-muted-foreground mt-1 text-xs'>{description}</p>
        )}
        {trend && (
          <div className='mt-2 flex items-center'>
            <Badge
              variant={trend.isPositive ? 'default' : 'secondary'}
              className='text-xs'
            >
              {trend.isPositive ? (
                <TrendingUp className='mr-1 h-3 w-3' />
              ) : (
                <TrendingDown className='mr-1 h-3 w-3' />
              )}
              {trend.isPositive ? '+' : ''}
              {trend.value.toFixed(1)}%
            </Badge>
            <span className='text-muted-foreground ml-2 text-xs'>
              {trend.period}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function StatsCards({
  stats,
  loading = false,
  error = null,
  className,
}: StatsCardsProps) {
  if (error) {
    return (
      <div
        className={`grid gap-4 md:grid-cols-2 lg:grid-cols-4 ${className || ''}`}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className='flex h-32 items-center justify-center'>
              <div className='text-muted-foreground text-center'>
                <p className='text-sm font-medium'>Error loading stats</p>
                <p className='mt-1 text-xs'>{error}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const cards = [
    {
      title: 'Total Quota Used',
      value: formatCurrency(stats.totalQuota),
      description: 'Cumulative quota consumption',
      icon: <DollarSign className='h-4 w-4' />,
      trend: {
        value: 12.5, // 这里可以从历史数据计算
        isPositive: true,
        period: 'from last month',
      },
    },
    {
      title: 'Total Tokens',
      value: formatNumber(stats.totalTokens),
      description: 'Tokens processed',
      icon: <Zap className='h-4 w-4' />,
      trend: {
        value: 8.3,
        isPositive: true,
        period: 'from last month',
      },
    },
    {
      title: 'Total Requests',
      value: formatNumber(stats.totalRequests),
      description: 'API calls made',
      icon: <Activity className='h-4 w-4' />,
      trend: {
        value: 15.2,
        isPositive: true,
        period: 'from last month',
      },
    },
    {
      title: 'Avg Cost/Request',
      value: formatCurrency(stats.avgQuotaPerRequest),
      description: 'Average quota per request',
      icon: <Users className='h-4 w-4' />,
      trend: {
        value: 2.1,
        isPositive: false,
        period: 'from last month',
      },
    },
  ]

  return (
    <div
      className={`grid gap-4 md:grid-cols-2 lg:grid-cols-4 ${className || ''}`}
    >
      {cards.map((card, index) => (
        <StatCard
          key={index}
          title={card.title}
          value={card.value}
          description={card.description}
          icon={card.icon}
          trend={card.trend}
          loading={loading}
        />
      ))}
    </div>
  )
}
