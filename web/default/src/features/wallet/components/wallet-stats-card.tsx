import { Activity, BarChart3, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { UserWalletData } from '../types'

interface WalletStatsCardProps {
  user: UserWalletData | null
  loading?: boolean
}

export function WalletStatsCard(props: WalletStatsCardProps) {
  const { t } = useTranslation()
  if (props.loading) {
    return (
      <Card className='overflow-hidden'>
        <CardContent className='p-0'>
          <div className='grid grid-cols-1 sm:grid-cols-3'>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center justify-center px-4 py-3 sm:px-5 sm:py-4',
                  i > 0 && 'border-t sm:border-t-0 sm:border-l'
                )}
              >
                <div className='w-full max-w-44'>
                  <Skeleton className='h-4 w-24' />
                  <Skeleton className='mt-2 h-7 w-32' />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const stats = [
    {
      label: t('Current Balance'),
      value: formatQuota(props.user?.quota ?? 0),
      icon: WalletCards,
    },
    {
      label: t('Total Usage'),
      value: formatQuota(props.user?.used_quota ?? 0),
      icon: BarChart3,
    },
    {
      label: t('API Requests'),
      value: (props.user?.request_count ?? 0).toLocaleString(),
      icon: Activity,
    },
  ]

  return (
    <Card className='overflow-hidden'>
      <CardContent className='p-0'>
        <div className='grid grid-cols-1 sm:grid-cols-3'>
          {stats.map((item, index) => (
            <div
              key={item.label}
              className={cn(
                'flex min-w-0 justify-center px-4 py-3 sm:px-5 sm:py-4',
                index > 0 && 'border-t sm:border-t-0 sm:border-l'
              )}
            >
              <div className='min-w-0 text-center'>
                <div className='text-muted-foreground flex items-center justify-center gap-1.5 text-xs font-medium'>
                  <item.icon className='h-3.5 w-3.5' />
                  {item.label}
                </div>
                <div className='mt-1 text-xl leading-tight font-semibold tracking-tight break-all lg:text-2xl'>
                  {item.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
