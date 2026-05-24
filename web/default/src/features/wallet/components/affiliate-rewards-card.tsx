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
import { Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatTokenQuotaDisplay } from '@/lib/ops-billing-display'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyButton } from '@/components/copy-button'
import { cn } from '@/lib/utils'
import type { UserWalletData } from '../types'

/** Outline controls on the affiliate card — high default contrast in dark mode. */
const WALLET_OUTLINE_BTN =
  'border-slate-300 bg-white text-slate-900 shadow-sm hover:bg-slate-100 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-50 dark:hover:border-slate-400 dark:hover:bg-slate-700 dark:disabled:border-slate-600 dark:disabled:bg-slate-900 dark:disabled:text-slate-400'

const AFFILIATE_LINK_INPUT =
  'h-9 min-w-0 flex-1 border-slate-300 bg-white font-mono text-sm text-slate-900 placeholder:text-slate-500 dark:border-slate-500 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400'

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
      <Card className='border border-slate-200 bg-slate-50 py-0 dark:border-slate-600 dark:bg-slate-900'>
        <CardContent className='grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,0.72fr)_minmax(320px,1.15fr)] lg:items-center'>
          <div>
            <Skeleton className='h-5 w-32 dark:bg-slate-700' />
            <Skeleton className='mt-2 h-4 w-48 dark:bg-slate-700' />
          </div>
          <Skeleton className='h-14 rounded-lg dark:bg-slate-700' />
          <Skeleton className='h-10 rounded-lg dark:bg-slate-700' />
        </CardContent>
      </Card>
    )
  }

  const hasRewards = (user?.aff_quota ?? 0) > 0

  return (
    <Card className='border border-slate-200 bg-slate-50 py-0 dark:border-slate-600 dark:bg-slate-900'>
      <CardContent className='grid gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[minmax(200px,1fr)_minmax(180px,0.65fr)_minmax(280px,1fr)] lg:items-center'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <div className='flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800'>
            <Share2 className='size-4 text-slate-600 dark:text-slate-200' />
          </div>
          <div className='min-w-0'>
            <h3 className='truncate text-sm font-semibold text-slate-900 dark:text-slate-50'>
              {t('wallet.affiliate.title')}
            </h3>
            <p className='line-clamp-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200'>
              {t('wallet.affiliate.description')}
            </p>
          </div>
        </div>

        <div className='grid grid-cols-3 gap-2 text-center'>
          {[
            [t('Pending'), formatTokenQuotaDisplay(user?.aff_quota ?? 0)],
            [
              t('Total Earned'),
              formatTokenQuotaDisplay(user?.aff_history_quota ?? 0),
            ],
            [t('Invites'), String(user?.aff_count ?? 0)],
          ].map(([label, value]) => (
            <div
              key={label}
              className='rounded-lg border border-slate-200 bg-white px-2 py-2 dark:border-slate-600 dark:bg-slate-800'
            >
              <div className='truncate text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-200'>
                {label}
              </div>
              <div className='mt-1 truncate text-base font-bold tabular-nums text-slate-900 dark:text-slate-50'>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className='flex items-center gap-2'>
          <Input
            value={affiliateLink}
            readOnly
            className={AFFILIATE_LINK_INPUT}
          />
          <CopyButton
            value={affiliateLink}
            variant='outline'
            className={cn('size-9 shrink-0', WALLET_OUTLINE_BTN)}
            iconClassName='size-4 text-slate-700 dark:text-slate-100'
            tooltip={t('Copy referral link')}
            aria-label={t('Copy referral link')}
          />
          {hasRewards && (
            <Button
              onClick={onTransfer}
              disabled={!complianceConfirmed}
              variant='outline'
              className={cn('h-9 shrink-0 px-3', WALLET_OUTLINE_BTN)}
              size='sm'
            >
              {t('wallet.affiliate.transfer_button')}
            </Button>
          )}
        </div>
        {!complianceConfirmed ? (
          <p className='text-sm leading-relaxed text-slate-600 lg:col-span-3 dark:text-slate-200'>
            {t('wallet.affiliate.compliance_note')}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
