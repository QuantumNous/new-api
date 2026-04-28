import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const { t } = useTranslation()
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='mt-2 h-4 w-48' />
        </CardHeader>
        <CardContent className='space-y-8'>
          {/* Statistics Skeleton */}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6'>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className='space-y-2'>
                <Skeleton className='h-3 w-16' />
                <Skeleton className='h-8 w-24' />
              </div>
            ))}
          </div>

          {/* Affiliate Link Skeleton */}
          <div className='space-y-3'>
            <Skeleton className='h-3 w-32' />
            <div className='flex gap-2'>
              <Skeleton className='h-10 flex-1' />
              <Skeleton className='size-9' />
            </div>
          </div>

          {/* Info Section Skeleton */}
          <Skeleton className='h-20 w-full rounded-lg' />
        </CardContent>
      </Card>
    )
  }

  const hasRewards = (user?.aff_quota ?? 0) > 0

  return (
    <Card>
      <CardHeader>
        <h3 className='text-xl font-semibold tracking-tight'>
          {t('Referral Program')}
        </h3>
        <p className='text-muted-foreground mt-2 text-sm'>
          {t('Share your link and earn rewards')}
        </p>
      </CardHeader>
      <CardContent className='space-y-8'>
        {/* Statistics */}
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6'>
          <div className='space-y-2'>
            <div className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
              {t('Pending')}
            </div>
            <div className='text-2xl font-semibold'>
              {formatQuota(user?.aff_quota ?? 0)}
            </div>
          </div>

          <div className='space-y-2'>
            <div className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
              {t('Total Earned')}
            </div>
            <div className='text-2xl font-semibold'>
              {formatQuota(user?.aff_history_quota ?? 0)}
            </div>
          </div>

          <div className='space-y-2'>
            <div className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
              {t('Invites')}
            </div>
            <div className='text-2xl font-semibold'>{user?.aff_count ?? 0}</div>
          </div>
        </div>

        {/* Transfer Button */}
        {hasRewards && (
          <Button onClick={onTransfer} className='w-full' variant='default'>
            {t('Transfer to Balance')}
          </Button>
        )}

        {/* Affiliate Link */}
        <div className='space-y-3'>
          <Label className='text-muted-foreground text-xs tracking-wider uppercase'>
            {t('Your Referral Link')}
          </Label>
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
              tooltip={t('Copy referral link')}
              aria-label={t('Copy referral link')}
            />
          </div>
        </div>

        {/* Info */}
        <div className='bg-muted/30 space-y-2 rounded-lg p-4'>
          <p className='text-muted-foreground text-sm leading-relaxed'>
            {t(
              'Earn rewards when your referrals add funds. Transfer accumulated rewards to your balance anytime.'
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
