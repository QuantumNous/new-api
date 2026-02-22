import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
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
      <Card>
        <CardContent>
          <div className='grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8'>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className='space-y-2'>
                <Skeleton className='h-5 w-28' />
                <Skeleton className='h-11 w-32' />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <div className='grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8'>
          {/* Current Balance */}
          <div className='min-w-0 space-y-2'>
            <div className='text-muted-foreground text-sm font-medium'>
              {t('Current Balance')}
            </div>
            <div className='text-3xl leading-tight font-semibold tracking-tight break-all lg:text-4xl'>
              {formatQuota(props.user?.quota ?? 0)}
            </div>
          </div>

          {/* Total Usage */}
          <div className='min-w-0 space-y-2'>
            <div className='text-muted-foreground text-sm font-medium'>
              {t('Total Usage')}
            </div>
            <div className='text-3xl leading-tight font-semibold tracking-tight break-all lg:text-4xl'>
              {formatQuota(props.user?.used_quota ?? 0)}
            </div>
          </div>

          {/* Request Count */}
          <div className='min-w-0 space-y-2'>
            <div className='text-muted-foreground text-sm font-medium'>
              {t('API Requests')}
            </div>
            <div className='text-3xl leading-tight font-semibold tracking-tight break-all lg:text-4xl'>
              {(props.user?.request_count ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
