import { Users, TrendingUp, BarChart3, Copy, Zap } from 'lucide-react'
import { formatQuota } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { UserWalletData } from '../types'

interface AffiliateRewardsCardProps {
  user: UserWalletData | null
  affiliateLink: string
  onCopyLink: () => void
  onTransfer: () => void
  loading?: boolean
}

export function AffiliateRewardsCard({
  user,
  affiliateLink,
  onCopyLink,
  onTransfer,
  loading,
}: AffiliateRewardsCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Users className='h-5 w-5' />
            Affiliate Rewards
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-6'>
          <Skeleton className='h-32 w-full' />
          <Skeleton className='h-20 w-full' />
        </CardContent>
      </Card>
    )
  }

  const hasRewards = (user?.aff_quota ?? 0) > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Users className='h-5 w-5' />
          Affiliate Rewards
        </CardTitle>
        <p className='text-muted-foreground text-sm'>
          Invite friends and earn rewards
        </p>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* Statistics Card */}
        <div className='overflow-hidden rounded-lg border'>
          <div className='bg-gradient-to-br from-green-500 to-green-700 p-6 text-white'>
            <div className='mb-2 flex items-center justify-between'>
              <h3 className='text-lg font-semibold'>Earnings Statistics</h3>
              <Button
                size='sm'
                variant='secondary'
                onClick={onTransfer}
                disabled={!hasRewards}
                className='gap-1'
              >
                <Zap className='h-3.5 w-3.5' />
                Transfer
              </Button>
            </div>
            <div className='grid grid-cols-3 gap-6'>
              {/* Pending Rewards */}
              <div className='text-center'>
                <div className='mb-2 text-2xl font-bold'>
                  {formatQuota(user?.aff_quota ?? 0)}
                </div>
                <div className='flex items-center justify-center gap-1 text-sm text-white/80'>
                  <TrendingUp className='h-3.5 w-3.5' />
                  <span>Pending</span>
                </div>
              </div>

              {/* Total Earnings */}
              <div className='text-center'>
                <div className='mb-2 text-2xl font-bold'>
                  {formatQuota(user?.aff_history_quota ?? 0)}
                </div>
                <div className='flex items-center justify-center gap-1 text-sm text-white/80'>
                  <BarChart3 className='h-3.5 w-3.5' />
                  <span>Total</span>
                </div>
              </div>

              {/* Invites */}
              <div className='text-center'>
                <div className='mb-2 text-2xl font-bold'>
                  {user?.aff_count ?? 0}
                </div>
                <div className='flex items-center justify-center gap-1 text-sm text-white/80'>
                  <Users className='h-3.5 w-3.5' />
                  <span>Invites</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Affiliate Link */}
        <div className='space-y-2'>
          <label className='text-sm font-medium'>Referral Link</label>
          <div className='flex gap-2'>
            <Input value={affiliateLink} readOnly className='font-mono' />
            <Button onClick={onCopyLink} className='shrink-0 gap-2'>
              <Copy className='h-4 w-4' />
              Copy
            </Button>
          </div>
        </div>

        {/* Rewards Info */}
        <div className='bg-muted/50 space-y-2 rounded-lg border p-4'>
          <h4 className='font-medium'>Reward Rules</h4>
          <div className='text-muted-foreground space-y-2 text-sm'>
            <div className='flex items-start gap-2'>
              <Badge variant='secondary' className='mt-0.5 shrink-0'>
                1
              </Badge>
              <p>Invite friends to register and earn rewards when they topup</p>
            </div>
            <div className='flex items-start gap-2'>
              <Badge variant='secondary' className='mt-0.5 shrink-0'>
                2
              </Badge>
              <p>
                Transfer rewards to your balance using the transfer function
              </p>
            </div>
            <div className='flex items-start gap-2'>
              <Badge variant='secondary' className='mt-0.5 shrink-0'>
                3
              </Badge>
              <p>More invites = more rewards!</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
