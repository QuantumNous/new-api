import type { DashboardStats, UserSelf } from '@/types/api'
import {
  DollarSign,
  Activity,
  Users,
  Zap,
  Wallet,
  BarChart3,
  Clock,
  Timer,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface StatsCardsProps {
  stats: DashboardStats
  userStats?: UserSelf | null
  loading?: boolean
  error?: string | null
  className?: string
}

export function StatsCards({
  stats,
  userStats,
  loading = false,
  error = null,
  className,
}: StatsCardsProps) {
  const { t } = useTranslation()
  if (error) {
    return (
      <div
        className={`grid gap-4 md:grid-cols-2 lg:grid-cols-4 ${className || ''}`}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className='flex h-32 items-center justify-center'>
              <div className='text-muted-foreground text-center'>
                <p className='text-sm font-medium'>
                  {t('dashboard.error_loading_stats')}
                </p>
                <p className='mt-1 text-xs'>{error}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // 计算性能指标
  const calculateRPM = () => {
    const timeSpanMinutes = 7 * 24 * 60 // 7天转换为分钟
    return stats.totalRequests > 0
      ? (stats.totalRequests / timeSpanMinutes).toFixed(3)
      : '0'
  }

  const calculateTPM = () => {
    const timeSpanMinutes = 7 * 24 * 60 // 7天转换为分钟
    return stats.totalTokens > 0
      ? (stats.totalTokens / timeSpanMinutes).toFixed(3)
      : '0'
  }

  const cardGroups = [
    {
      title: t('dashboard.stats.account_data'),
      icon: <Wallet className='text-muted-foreground h-4 w-4' />,
      items: [
        {
          label: t('dashboard.stats.current_balance'),
          value: formatCurrency(userStats?.quota || 0),
          icon: <DollarSign className='text-muted-foreground h-4 w-4' />,
        },
        {
          label: t('dashboard.stats.historical_consumption'),
          value: formatCurrency(userStats?.used_quota || 0),
          icon: <BarChart3 className='text-muted-foreground h-4 w-4' />,
        },
      ],
    },
    {
      title: t('dashboard.stats.usage_statistics'),
      icon: <Activity className='text-muted-foreground h-4 w-4' />,
      items: [
        {
          label: t('dashboard.stats.request_count'),
          value: formatNumber(userStats?.request_count || 0),
          icon: <Users className='text-muted-foreground h-4 w-4' />,
        },
        {
          label: t('dashboard.stats.statistical_count'),
          value: formatNumber(stats.totalRequests),
          icon: <Activity className='text-muted-foreground h-4 w-4' />,
        },
      ],
    },
    {
      title: t('dashboard.stats.resource_consumption'),
      icon: <Zap className='text-muted-foreground h-4 w-4' />,
      items: [
        {
          label: t('dashboard.stats.statistical_quota'),
          value: formatCurrency(stats.totalQuota),
          icon: <DollarSign className='text-muted-foreground h-4 w-4' />,
        },
        {
          label: t('dashboard.stats.statistical_tokens'),
          value: formatNumber(stats.totalTokens),
          icon: <Zap className='text-muted-foreground h-4 w-4' />,
        },
      ],
    },
    {
      title: t('dashboard.stats.performance_metrics'),
      icon: <Clock className='text-muted-foreground h-4 w-4' />,
      items: [
        {
          label: t('dashboard.stats.average_rpm'),
          value: calculateRPM(),
          icon: <Clock className='text-muted-foreground h-4 w-4' />,
        },
        {
          label: t('dashboard.stats.average_tpm'),
          value: calculateTPM(),
          icon: <Timer className='text-muted-foreground h-4 w-4' />,
        },
      ],
    },
  ]

  if (loading) {
    return (
      <div
        className={`grid gap-4 md:grid-cols-2 lg:grid-cols-4 ${className || ''}`}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className='pb-3'>
              <div className='flex items-center justify-between'>
                <Skeleton className='h-5 w-24' />
                <Skeleton className='h-5 w-5 rounded-full' />
              </div>
            </CardHeader>
            <CardContent className='space-y-3'>
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className='flex items-center justify-between'>
                  <div className='flex items-center space-x-2'>
                    <Skeleton className='h-4 w-4 rounded-full' />
                    <Skeleton className='h-4 w-16' />
                  </div>
                  <Skeleton className='h-6 w-20' />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div
      className={`grid gap-4 md:grid-cols-2 lg:grid-cols-4 ${className || ''}`}
    >
      {cardGroups.map((group, index) => (
        <Card key={index}>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>{group.title}</CardTitle>
            {group.icon}
          </CardHeader>
          <CardContent className='space-y-3'>
            {group.items.map((item, itemIndex) => (
              <div
                key={itemIndex}
                className='flex items-center justify-between'
              >
                <div className='flex items-center space-x-2'>
                  {item.icon}
                  <span className='text-muted-foreground text-sm'>
                    {item.label}
                  </span>
                </div>
                <span className='text-xl font-bold'>{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
