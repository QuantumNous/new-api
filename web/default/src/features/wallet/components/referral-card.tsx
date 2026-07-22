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
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Share2, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import { useStatus } from '@/hooks/use-status'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyButton } from '@/components/copy-button'
import { GLASS_CARD_CLS } from '../constants'
import { useAffiliate } from '../hooks'
import type { UserWalletData } from '../types'
import { TransferDialog } from './dialogs/transfer-dialog'

interface ReferralCardProps {
  user: UserWalletData | null
  onSuccess: () => void
}

export function ReferralCard({ user, onSuccess }: ReferralCardProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const statusData = status as {
    aff_ratio?: number
    effective_aff_ratio?: number
  } | null
  const affRatio = statusData?.effective_aff_ratio ?? statusData?.aff_ratio ?? 0
  const [transferOpen, setTransferOpen] = useState(false)
  const { affiliateLink, loading, transferring, transferQuota } = useAffiliate()

  async function handleTransfer(amount: number) {
    const ok = await transferQuota(amount)
    if (ok) onSuccess()
    return ok
  }

  if (loading) {
    return (
      <Card className={GLASS_CARD_CLS}>
        <CardContent className='p-4'>
          <Skeleton className='mb-3 h-5 w-32' />
          <Skeleton className='h-9 w-full' />
        </CardContent>
      </Card>
    )
  }

  const hasRewards = (user?.aff_quota ?? 0) > 0

  return (
    <>
      <Card className={GLASS_CARD_CLS}>
        <CardHeader className='pb-2'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Share2 className='text-muted-foreground size-4' />
              <h3 className='text-base font-semibold'>
                {t('Referral Program')}
              </h3>
            </div>
            <Link
              to='/affiliate'
              className='text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs'
            >
              {t('View Details')} <ExternalLink className='size-3' />
            </Link>
          </div>
          {affRatio > 0 && (
            <p className='text-muted-foreground text-xs'>
              {t('After friend tops up, you earn')}{' '}
              <span className='font-medium text-green-500'>{affRatio}%</span>
            </p>
          )}
        </CardHeader>
        <CardContent className='flex flex-col gap-2'>
          <div className='grid grid-cols-3 gap-1 text-center'>
            {[
              [t('Pending'), formatQuota(user?.aff_quota ?? 0)],
              [t('Total Earned'), formatQuota(user?.aff_history_quota ?? 0)],
              [t('Invites'), String(user?.aff_count ?? 0)],
            ].map(([label, value]) => (
              <div key={label} className='rounded-lg px-1 py-1.5'>
                <div className='text-muted-foreground truncate text-[10px] font-medium'>
                  {label}
                </div>
                <div className='text-sm font-semibold tabular-nums'>
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
          </div>

          {hasRewards && (
            <Button
              variant='outline'
              size='sm'
              className='w-full'
              onClick={() => setTransferOpen(true)}
              disabled={transferring}
            >
              {t('Transfer to Balance')}
            </Button>
          )}
        </CardContent>
      </Card>

      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        onConfirm={handleTransfer}
        availableQuota={user?.aff_quota ?? 0}
        transferring={transferring}
      />
    </>
  )
}
