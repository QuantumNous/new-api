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
import { Plus, Share2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { CopyButton } from '@/components/copy-button'
import type { UserWalletData } from '../types'

interface AffiliateRewardsCardProps {
  user: UserWalletData | null
  affiliateLink: string
  onTransfer: () => void
  onCreateInviteCode?: (count?: number) => void
  createdInviteCodes?: string[]
  creatingInviteCode?: boolean
  inviteCodeMaxCount?: number
  complianceConfirmed?: boolean
  loading?: boolean
}

export function AffiliateRewardsCard({
  user,
  affiliateLink,
  onTransfer,
  onCreateInviteCode,
  createdInviteCodes = [],
  creatingInviteCode = false,
  inviteCodeMaxCount = 100,
  complianceConfirmed = true,
  loading,
}: AffiliateRewardsCardProps) {
  const { t } = useTranslation()
  const [inviteCodeCount, setInviteCodeCount] = useState(1)
  const normalizedInviteCodeMaxCount = Math.max(
    1,
    Math.min(
      100,
      Number.isFinite(inviteCodeMaxCount) ? Math.trunc(inviteCodeMaxCount) : 100
    )
  )
  const clampInviteCodeCount = (value: number) => {
    const nextCount = Number.isFinite(value) ? Math.trunc(value) : 1
    return Math.max(1, Math.min(normalizedInviteCodeMaxCount, nextCount))
  }

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

  const hasRewards = (user?.aff_quota ?? 0) > 0
  const inviteCodesText = createdInviteCodes.join('\n')

  return (
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

        <div className='grid grid-cols-3 gap-1.5 text-center'>
          {[
            [t('Pending'), formatQuota(user?.aff_quota ?? 0)],
            [t('Total Earned'), formatQuota(user?.aff_history_quota ?? 0)],
            [t('Invites'), String(user?.aff_count ?? 0)],
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

        <div className='flex flex-wrap items-center gap-2'>
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
          {hasRewards && (
            <Button
              onClick={onTransfer}
              disabled={!complianceConfirmed}
              className='h-9 shrink-0 px-3'
              size='sm'
            >
              {t('Transfer to Balance')}
            </Button>
          )}
          {onCreateInviteCode ? (
            <>
              <Input
                type='number'
                min={1}
                max={normalizedInviteCodeMaxCount}
                value={inviteCodeCount}
                onChange={(event) =>
                  setInviteCodeCount(
                    clampInviteCodeCount(Number(event.target.value))
                  )
                }
                aria-label={t('Quantity')}
                className='border-muted bg-background/70 h-9 w-20 shrink-0 text-xs'
              />
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() =>
                  onCreateInviteCode(clampInviteCodeCount(inviteCodeCount))
                }
                disabled={creatingInviteCode}
                className='bg-background h-9 shrink-0 gap-1.5 px-3'
              >
                <Plus className='size-4' />
                {t('Create Invite Code')}
              </Button>
            </>
          ) : null}
        </div>
        {createdInviteCodes.length > 0 ? (
          <div className='grid gap-2 lg:col-span-3'>
            <div className='flex items-center justify-between gap-2'>
              <label className='text-sm font-medium'>
                {t('Created Invite Code')}
              </label>
              <CopyButton
                value={inviteCodesText}
                variant='outline'
                size='sm'
                tooltip={t('Copy invitation code')}
                aria-label={t('Copy invitation code')}
              />
            </div>
            {createdInviteCodes.length === 1 ? (
              <Input
                readOnly
                value={createdInviteCodes[0]}
                className='border-muted bg-background/70 font-mono text-xs'
              />
            ) : (
              <Textarea
                readOnly
                rows={Math.min(5, createdInviteCodes.length)}
                value={inviteCodesText}
                className='border-muted bg-background/70 font-mono text-xs'
              />
            )}
          </div>
        ) : null}
        {!complianceConfirmed ? (
          <p className='text-muted-foreground text-xs lg:col-span-3'>
            {t(
              'Referral reward transfer is disabled until the administrator confirms compliance terms.'
            )}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
