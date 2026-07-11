/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/design-system/button'
import { Input } from '@/components/design-system/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuota } from '@/lib/format'

import type { UserWalletData } from '../types'

interface AffiliateRewardsCardProps {
  user: UserWalletData | null
  affiliateLink: string
  onTransfer: () => void
  complianceConfirmed?: boolean
  loading?: boolean
}

export function AffiliateRewardsCard({
  user,
  affiliateLink,
  onTransfer,
  complianceConfirmed = true,
  loading,
}: AffiliateRewardsCardProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <Card data-card-hover='false' className='py-0'>
        <CardContent className='space-y-3 p-4 sm:p-5'>
          <Skeleton className='h-5 w-32' />
          <Skeleton className='h-4 w-full max-w-md' />
          <Skeleton className='h-8 w-full' />
        </CardContent>
      </Card>
    )
  }

  const hasRewards = (user?.aff_quota ?? 0) > 0
  const stats = [
    [t('Pending'), formatQuota(user?.aff_quota ?? 0)],
    [t('Total Earned'), formatQuota(user?.aff_history_quota ?? 0)],
    [t('Invites'), String(user?.aff_count ?? 0)],
  ]

  return (
    <Card data-card-hover='false' className='gap-0 py-0'>
      <CardContent className='flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between'>
        <div className='min-w-0'>
          <h3 className='text-sm font-medium'>{t('Referral Program')}</h3>
          <p className='text-muted-foreground mt-0.5 line-clamp-2 text-xs'>
            {t(
              'Earn rewards when users join through your referral link. Transfer accumulated rewards to your balance anytime.'
            )}
          </p>
          <div className='text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs'>
            {stats.map(([label, value]) => (
              <span key={label} className='inline-flex items-baseline gap-1.5'>
                {label}
                <span className='text-foreground font-medium tabular-nums'>
                  {value}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className='flex w-full items-center gap-2 lg:w-auto lg:max-w-xl lg:flex-1 lg:justify-end'>
          <Input
            value={affiliateLink}
            readOnly
            className='min-w-0 flex-1 font-mono text-xs lg:max-w-sm'
          />
          <CopyButton
            value={affiliateLink}
            variant='outline'
            className='shrink-0'
            iconClassName='size-4'
            tooltip={t('Copy referral link')}
            aria-label={t('Copy referral link')}
          />
          {hasRewards && (
            <Button
              onClick={onTransfer}
              disabled={!complianceConfirmed}
              className='shrink-0'
            >
              {t('Transfer to Balance')}
            </Button>
          )}
        </div>
      </CardContent>
      {!complianceConfirmed && (
        <div className='text-muted-foreground border-t px-4 py-2.5 text-xs sm:px-5'>
          {t(
            'Referral reward transfer is disabled until the administrator confirms compliance terms.'
          )}
        </div>
      )}
    </Card>
  )
}
