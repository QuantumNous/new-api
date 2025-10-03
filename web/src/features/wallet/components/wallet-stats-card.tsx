import { formatQuota } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { UserWalletData } from '../types'

interface WalletStatsCardProps {
  user: UserWalletData | null
  loading?: boolean
}

export function WalletStatsCard({ user, loading }: WalletStatsCardProps) {
  if (loading) {
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
          <div className='space-y-2'>
            <div className='text-muted-foreground text-sm font-medium'>
              Current Balance
            </div>
            <div className='text-4xl font-semibold tracking-tight'>
              {formatQuota(user?.quota ?? 0)}
            </div>
          </div>

          {/* Total Usage */}
          <div className='space-y-2'>
            <div className='text-muted-foreground text-sm font-medium'>
              Total Usage
            </div>
            <div className='text-4xl font-semibold tracking-tight'>
              {formatQuota(user?.used_quota ?? 0)}
            </div>
          </div>

          {/* Request Count */}
          <div className='space-y-2'>
            <div className='text-muted-foreground text-sm font-medium'>
              API Requests
            </div>
            <div className='text-4xl font-semibold tracking-tight'>
              {user?.request_count?.toLocaleString() ?? 0}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
