import { Wallet, TrendingUp, BarChart3 } from 'lucide-react'
import { formatQuota } from '@/lib/format'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { UserWalletData } from '../types'

interface WalletStatsCardProps {
  user: UserWalletData | null
  loading?: boolean
}

export function WalletStatsCard({ user, loading }: WalletStatsCardProps) {
  if (loading) {
    return (
      <Card className='overflow-hidden'>
        <div className='bg-gradient-to-br from-blue-500 to-blue-700 p-6 text-white'>
          <Skeleton className='mb-4 h-6 w-32 bg-white/20' />
          <div className='grid grid-cols-3 gap-6'>
            {[1, 2, 3].map((i) => (
              <div key={i} className='text-center'>
                <Skeleton className='mb-2 h-8 w-full bg-white/20' />
                <Skeleton className='mx-auto h-4 w-24 bg-white/20' />
              </div>
            ))}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className='overflow-hidden'>
      <div className='bg-gradient-to-br from-blue-500 to-blue-700 p-6 text-white'>
        <h3 className='mb-4 text-lg font-semibold'>Account Statistics</h3>
        <div className='grid grid-cols-3 gap-6'>
          {/* Current Balance */}
          <div className='text-center'>
            <div className='mb-2 text-2xl font-bold'>
              {formatQuota(user?.quota ?? 0)}
            </div>
            <div className='flex items-center justify-center gap-1 text-sm text-white/80'>
              <Wallet className='h-3.5 w-3.5' />
              <span>Current Balance</span>
            </div>
          </div>

          {/* Historical Usage */}
          <div className='text-center'>
            <div className='mb-2 text-2xl font-bold'>
              {formatQuota(user?.used_quota ?? 0)}
            </div>
            <div className='flex items-center justify-center gap-1 text-sm text-white/80'>
              <TrendingUp className='h-3.5 w-3.5' />
              <span>Total Usage</span>
            </div>
          </div>

          {/* Request Count */}
          <div className='text-center'>
            <div className='mb-2 text-2xl font-bold'>
              {user?.request_count?.toLocaleString() ?? 0}
            </div>
            <div className='flex items-center justify-center gap-1 text-sm text-white/80'>
              <BarChart3 className='h-3.5 w-3.5' />
              <span>Requests</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
