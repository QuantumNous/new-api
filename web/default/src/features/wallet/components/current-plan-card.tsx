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
import { CalendarDays } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatTimestampToDate } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { SubscriptionPlan } from '@/features/subscriptions/types'
import type { WalletSelfSubscriptionData } from '../lib/subscription-plan-lifecycle'
import { UsageWindowMeter } from './usage-window-meter'

type CurrentPlanCardProps = {
  plan: SubscriptionPlan
  selfData: WalletSelfSubscriptionData
}

function getRemainingDays(selfData: WalletSelfSubscriptionData): number {
  if (typeof selfData.remaining_days === 'number') {
    return Math.max(0, selfData.remaining_days)
  }
  const end =
    selfData.current_period?.end ||
    selfData.contract?.current_period_end ||
    selfData.current_entitlement?.end_time ||
    0
  if (!end) return 0
  return Math.max(0, Math.ceil((end * 1000 - Date.now()) / 86400000))
}

function isWalletAutoRenew(selfData: WalletSelfSubscriptionData): boolean {
  if (selfData.renewal_source === 'provider_recurring') return false
  if (
    selfData.renewal_source === 'wallet_auto' &&
    selfData.renewal_status === 'enabled'
  ) {
    return true
  }
  if (selfData.contract?.payment_mode === 'stripe_recurring') return false
  if (selfData.contract?.payment_mode === 'balance_one_period') return true
  return (
    selfData.renewal_source === 'balance' ||
    selfData.renewal_status === 'enabled'
  )
}

export function CurrentPlanCard(props: CurrentPlanCardProps) {
  const { t } = useTranslation()
  const start =
    props.selfData.current_period?.start ||
    props.selfData.contract?.current_period_start ||
    props.selfData.current_entitlement?.start_time
  const end =
    props.selfData.current_period?.end ||
    props.selfData.contract?.current_period_end ||
    props.selfData.current_entitlement?.end_time

  return (
    <Card className='shadow-none'>
      <CardContent className='space-y-4 p-4 sm:p-5'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='min-w-0'>
            <div className='text-muted-foreground text-xs font-medium'>
              {t('Current plan')}
            </div>
            <h3 className='mt-1 text-xl font-semibold'>{props.plan.title}</h3>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge>{t('Active')}</Badge>
            {isWalletAutoRenew(props.selfData) ? (
              <Badge variant='secondary'>{t('Auto-renew on')}</Badge>
            ) : null}
          </div>
        </div>

        <div className='grid gap-3 text-sm sm:grid-cols-3'>
          <div className='flex items-center gap-2'>
            <CalendarDays className='text-muted-foreground h-4 w-4' />
            <div>
              <div className='text-muted-foreground text-xs'>
                {t('Start date')}
              </div>
              <div className='font-medium'>{formatTimestampToDate(start)}</div>
            </div>
          </div>
          <div>
            <div className='text-muted-foreground text-xs'>{t('End date')}</div>
            <div className='font-medium'>{formatTimestampToDate(end)}</div>
          </div>
          <div>
            <div className='text-muted-foreground text-xs'>
              {t('Remaining days')}
            </div>
            <div className='font-medium tabular-nums'>
              {t('{{count}} days', { count: getRemainingDays(props.selfData) })}
            </div>
          </div>
        </div>

        <div className='grid gap-3 lg:grid-cols-3'>
          <UsageWindowMeter
            label={t('5-hour limit')}
            window={props.selfData.window_5h}
            secondary
          />
          <UsageWindowMeter
            label={t('7-day limit')}
            window={props.selfData.window_7d}
            secondary
          />
          <UsageWindowMeter
            label={t('Media generation credits')}
            window={props.selfData.media_credits}
            secondary
            media
          />
        </div>
      </CardContent>
    </Card>
  )
}
