import { Share2, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

import type { AffiliateSummary } from '../types'

interface AffiliateRewardsCardProps {
  summary?: AffiliateSummary
  affiliateLink: string
  onManage: () => void
  loading?: boolean
}

function formatMoney(micros: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'USD',
  }).format(micros / 1_000_000)
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

  const currency = props.summary?.currency ?? 'USD'
  const account = props.summary?.account
  const stats = [
    [t('Available'), formatMoney(account?.available_micros ?? 0, currency)],
    [t('Pending'), formatMoney(account?.pending_micros ?? 0, currency)],
    [t('Withdrawn'), formatMoney(account?.withdrawn_micros ?? 0, currency)],
    [t('Invites'), String(props.summary?.referral_count ?? 0)],
  ]

  return (
    <Card data-card-hover='false' className='bg-muted/20 py-0'>
      <CardContent className='grid gap-4 p-4 lg:grid-cols-[minmax(180px,0.75fr)_minmax(300px,1fr)_minmax(300px,1fr)] lg:items-center'>
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
            <p className='text-muted-foreground text-xs'>
              {t('Qualified referrals')}: {props.summary?.qualified_count ?? 0}
            </p>
          </div>
        </div>

        <div className='grid grid-cols-4 gap-2 text-center'>
          {stats.map(([label, value]) => (
            <div key={label} className='min-w-0'>
              <div className='text-muted-foreground truncate text-[10px] font-medium uppercase'>
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
            value={props.affiliateLink}
            readOnly
            className='border-muted bg-background/70 h-9 min-w-0 flex-1 font-mono text-xs'
          />
          <CopyButton
            value={props.affiliateLink}
            variant='outline'
            className='bg-background size-9 shrink-0'
            iconClassName='size-4'
            tooltip={t('Copy referral link')}
            aria-label={t('Copy referral link')}
          />
          <Button size='sm' className='h-9 shrink-0' onClick={props.onManage}>
            <WalletCards />
            {t('Manage')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
