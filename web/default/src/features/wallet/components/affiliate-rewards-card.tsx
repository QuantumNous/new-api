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
import { Share2, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuotaAsCNY, formatTimestampToDate } from '@/lib/format'

import type { AffiliateSummary } from '../types'

interface AffiliateRewardsCardProps {
  summary?: AffiliateSummary
  affiliateLink: string
  onManage: () => void
  loading?: boolean
}

export function AffiliateRewardsCard(props: AffiliateRewardsCardProps) {
  const { t } = useTranslation()
  if (props.loading) {
    return (
      <Card data-card-hover='false' className='bg-muted/20 py-0'>
        <CardContent className='grid gap-4 p-4 lg:grid-cols-[minmax(220px,1fr)_minmax(300px,1fr)]'>
          <Skeleton className='h-14' />
          <Skeleton className='h-14' />
        </CardContent>
      </Card>
    )
  }

  const account = props.summary?.account
  const rule = props.summary?.rule
  let rewardDescription = t('{{rate}}% cashback after first qualification', {
    rate: 0,
  })
  if (rule?.reward_mode === 'fixed') {
    const amount = formatQuotaAsCNY(rule.fixed_reward_quota)
    if (rule.cashback_frequency === 'every_topup') {
      rewardDescription = t('Fixed cashback {{amount}} on every top-up', {
        amount,
      })
    } else {
      rewardDescription = t(
        'Fixed cashback {{amount}} after first qualification',
        { amount }
      )
    }
  } else if (rule?.cashback_frequency === 'every_topup') {
    rewardDescription = t('{{rate}}% cashback on every top-up', {
      rate: rule.reward_rate_bps / 100,
    })
  } else if (rule) {
    rewardDescription = t('{{rate}}% cashback after first qualification', {
      rate: rule.reward_rate_bps / 100,
    })
  }

  const stats = [
    [t('Available'), formatQuotaAsCNY(account?.available_quota ?? 0)],
    [t('Frozen cashback'), formatQuotaAsCNY(account?.pending_quota ?? 0)],
    [t('Transferred'), formatQuotaAsCNY(account?.transferred_quota ?? 0)],
    [t('Invites'), String(props.summary?.referral_count ?? 0)],
  ]

  return (
    <Card data-card-hover='false' className='bg-muted/20 py-0'>
      <CardContent className='grid gap-4 p-4 xl:grid-cols-[minmax(220px,0.8fr)_minmax(320px,1fr)_minmax(420px,1.5fr)] xl:items-center'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <IconBadge tone='chart-3'>
            <Share2 />
          </IconBadge>
          <div className='min-w-0'>
            <div className='flex items-center gap-2'>
              <h3 className='truncate text-sm font-semibold'>
                {t('Referral Cashback')}
              </h3>
              {!props.summary?.enabled ? (
                <Badge variant='outline'>{t('Disabled')}</Badge>
              ) : null}
            </div>
            <p className='text-muted-foreground truncate text-xs'>
              {rewardDescription}
            </p>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4'>
          {stats.map(([label, value], index) => (
            <div key={label} className='min-w-0'>
              <div className='text-muted-foreground truncate text-[10px] font-medium uppercase'>
                {label}
              </div>
              <div className='mt-0.5 truncate text-sm font-semibold tabular-nums'>
                {value}
              </div>
              {index === 1 && props.summary?.next_available_at ? (
                <div className='text-muted-foreground mt-0.5 truncate text-[10px]'>
                  {t('Unlocks {{time}}', {
                    time: formatTimestampToDate(
                      props.summary.next_available_at
                    ),
                  })}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className='grid min-w-0 gap-2 sm:grid-cols-[minmax(120px,0.35fr)_minmax(240px,1fr)_auto] sm:items-end'>
          <div className='grid min-w-0 gap-1'>
            <span className='text-muted-foreground text-xs font-medium'>
              {t('Invitation Code')}
            </span>
            <div className='border-muted bg-background/70 flex min-h-9 min-w-0 items-center rounded-md border pl-3'>
              <span className='min-w-0 flex-1 truncate font-mono text-xs'>
                {props.summary?.referral_code || '-'}
              </span>
              {props.summary?.referral_code ? (
                <CopyButton
                  value={props.summary.referral_code}
                  className='size-8'
                  iconClassName='size-4'
                  tooltip={t('Copy invitation code')}
                  aria-label={t('Copy invitation code')}
                />
              ) : null}
            </div>
          </div>

          <div className='grid min-w-0 gap-1'>
            <span className='text-muted-foreground text-xs font-medium'>
              {t('Invitation Link')}
            </span>
            <div className='border-muted bg-background/70 flex min-h-9 min-w-0 items-center rounded-md border py-1 pl-3'>
              <span className='min-w-0 flex-1 font-mono text-xs leading-4 break-all'>
                {props.affiliateLink || '-'}
              </span>
              {props.affiliateLink ? (
                <CopyButton
                  value={props.affiliateLink}
                  className='size-8'
                  iconClassName='size-4'
                  tooltip={t('Copy referral link')}
                  aria-label={t('Copy referral link')}
                />
              ) : null}
            </div>
          </div>

          <Button size='sm' className='h-9 shrink-0' onClick={props.onManage}>
            <WalletCards data-icon='inline-start' />
            {t('Manage')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
