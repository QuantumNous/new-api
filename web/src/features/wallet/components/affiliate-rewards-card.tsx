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
import { useState, memo } from 'react'
import { Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyButton } from '@/components/copy-button'
import type { UserWalletData } from '../types'

const formatUSD = (val: number) => {
  return `$${val.toFixed(2)}`
}

interface AffiliateRewardsCardProps {
  user: UserWalletData | null
  affiliateLink: string
  commissionBalance?: number
  commissionTotalEarned?: number
  onCommissionTransfer?: (amount: number) => void
  complianceConfirmed?: boolean
  loading?: boolean
}

export const AffiliateRewardsCard = memo(function AffiliateRewardsCard({
  user,
  affiliateLink,
  commissionBalance = 0,
  commissionTotalEarned = 0,
  onCommissionTransfer,
  complianceConfirmed = true,
  loading,
}: AffiliateRewardsCardProps) {
  const { t } = useTranslation()
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [transferAmount, setTransferAmount] = useState('')
  if (loading) {
    return (
      <Card className='bg-muted/20 py-0'>
        <CardContent className='grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,0.72fr)_minmax(320px,1.15fr)] lg:items-center'>
          <div>
            <Skeleton className='h-5 w-32' />
            <Skeleton className='mt-2 h-4 w-48' />
          </div>
          <Skeleton className='h-14 rounded-lg' />
          <Skeleton className='h-10 rounded-lg' />
        </CardContent>
      </Card>
    )
  }

  const hasCommission = commissionBalance > 0

  return (
    <>
      <Card className='bg-muted/20 py-0'>
        <CardContent className='grid gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[minmax(200px,1fr)_minmax(180px,0.65fr)_minmax(280px,1fr)] lg:items-center'>
          <div className='flex min-w-0 items-center gap-2.5'>
            <div className='bg-background flex size-8 shrink-0 items-center justify-center rounded-lg border'>
              <Share2 className='text-muted-foreground size-4' />
            </div>
            <div className='min-w-0'>
              <h3 className='truncate text-sm font-semibold'>
                {t('Referral Program')}
              </h3>
              <p className='text-muted-foreground line-clamp-1 text-xs'>
                {t(
                  'Earn rewards when your referrals add funds. Transfer accumulated rewards to your balance anytime.'
                )}
              </p>
            </div>
          </div>

          <div className='grid grid-cols-2 gap-1.5 text-center'>
            {[
              [t('Pending'), formatUSD(commissionBalance)],
              [t('Total Earned'), formatUSD(commissionTotalEarned)],
            ].map(([label, value]) => (
              <div key={label}>
                <div className='text-muted-foreground truncate text-[10px] font-medium tracking-wider uppercase'>
                  {label}
                </div>
                <div className='mt-0.5 truncate text-sm font-semibold tabular-nums'>
                  {value}
                </div>
            </div>
          ))}
        </div>

        <div className='flex items-center gap-2'>
          <Input
            value={affiliateLink}
            readOnly
            className='border-muted bg-background/70 h-9 min-w-0 flex-1 font-mono text-xs'
          />
          <CopyButton
            value={affiliateLink}
            variant='outline'
            className='bg-background size-9 shrink-0'
            iconClassName='size-4'
            tooltip={t('Copy referral link')}
            aria-label={t('Copy referral link')}
          />
          {hasCommission && onCommissionTransfer ? (
            <Button
              onClick={() => {
                setTransferAmount('')
                setTransferDialogOpen(true)
              }}
              disabled={!complianceConfirmed}
              className='h-9 shrink-0 px-3'
              size='sm'
            >
              {t('Transfer to Balance')}
            </Button>
          ) : null}
        </div>
        {!complianceConfirmed ? (
          <p className='text-muted-foreground text-xs lg:col-span-3'>
            {t(
              'Referral reward transfer is disabled until the administrator confirms compliance terms.'
            )}
          </p>
        ) : null}
      </CardContent>
    </Card>

    {/* Transfer to Balance Dialog */}
    {transferDialogOpen && (
      <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
        <div className='w-full max-w-md rounded-lg bg-card p-6 shadow-lg'>
          <h3 className='text-lg font-semibold mb-4'>{t('Transfer to Balance')}</h3>
          <div className='space-y-4'>
            <div>
              <label className='text-sm text-muted-foreground mb-1 block'>
                {t('Amount')}
              </label>
              <input
                type='number'
                step='0.01'
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder='0.00'
                min={0}
                max={commissionBalance}
                className='w-full rounded border px-3 py-2 text-sm'
              />
              <p className='text-xs text-muted-foreground mt-1'>
                {t('Available balance')}: {formatUSD(commissionBalance)}
              </p>
            </div>
            <div className='flex justify-end gap-2 pt-2'>
              <Button
                variant='outline'
                onClick={() => {
                  setTransferDialogOpen(false)
                  setTransferAmount('')
                }}
              >
                {t('Cancel')}
              </Button>
              <Button
                variant='default'
                onClick={() => {
                  const num = parseFloat(transferAmount)
                  if (isNaN(num) || num <= 0 || num > commissionBalance) return
                  onCommissionTransfer?.(num)
                  setTransferDialogOpen(false)
                  setTransferAmount('')
                }}
                disabled={
                  (() => {
                    const num = parseFloat(transferAmount)
                    return isNaN(num) || num <= 0 || num > commissionBalance
                  })()
                }
              >
                {t('Transfer to Balance')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  )
})
