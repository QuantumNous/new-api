import { formatQuota } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyButton } from '@/components/copy-button'
import type { UserWalletData } from '../types'

interface AffiliateRewardsCardProps {
  user: UserWalletData | null
  affiliateLink: string
  onTransfer: () => void
  loading?: boolean
}

export function AffiliateRewardsCard({
  user,
  affiliateLink,
  onTransfer,
  loading,
}: AffiliateRewardsCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='mt-2 h-4 w-48' />
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
        <h3 className='text-xl font-semibold tracking-tight'>
          Referral Program
        </h3>
        <p className='text-muted-foreground mt-2 text-sm'>
          Share your link and earn rewards
        </p>
      </CardHeader>
      <CardContent className='space-y-8'>
        {/* Statistics */}
        <div className='grid grid-cols-3 gap-6'>
          <div className='space-y-2'>
            <div className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
              Pending
            </div>
            <div className='text-2xl font-semibold'>
              {formatQuota(user?.aff_quota ?? 0)}
            </div>
          </div>

          <div className='space-y-2'>
            <div className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
              Total Earned
            </div>
            <div className='text-2xl font-semibold'>
              {formatQuota(user?.aff_history_quota ?? 0)}
            </div>
          </div>

          <div className='space-y-2'>
            <div className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
              Invites
            </div>
            <div className='text-2xl font-semibold'>{user?.aff_count ?? 0}</div>
          </div>
        </div>

        {/* Transfer Button */}
        {hasRewards && (
          <Button onClick={onTransfer} className='w-full' variant='default'>
            Transfer to Balance
          </Button>
        )}

        {/* Affiliate Link */}
        <div className='space-y-3'>
          <label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
            Your Referral Link
          </label>
          <div className='flex gap-2'>
            <Input
              value={affiliateLink}
              readOnly
              className='border-muted bg-muted/30 font-mono text-sm'
            />
            <CopyButton
              value={affiliateLink}
              variant='outline'
              className='size-9'
              iconClassName='size-4'
              tooltip='Copy referral link'
              aria-label='Copy referral link'
            />
          </div>
        </div>

        {/* Info */}
        <div className='bg-muted/30 space-y-2 rounded-lg p-4'>
          <p className='text-muted-foreground text-sm leading-relaxed'>
            Earn rewards when your referrals add funds. Transfer accumulated
            rewards to your balance anytime.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
