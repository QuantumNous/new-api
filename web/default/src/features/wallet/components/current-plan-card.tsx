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
import { CalendarDays } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatTimestampToDate } from '@/lib/format'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type {
  SubscriptionPlan,
  SubscriptionRenewalSource,
} from '@/features/subscriptions/types'
import type { WalletSelfSubscriptionData } from '../lib/subscription-plan-lifecycle'
import { UsageWindowMeter } from './usage-window-meter'

type CurrentPlanCardProps = {
  plan: SubscriptionPlan
  selfData: WalletSelfSubscriptionData
  renewalMutationPending: boolean
  onCancelRenewal: () => Promise<void>
  onResumeRenewal: () => Promise<void>
}

type RenewalAction = 'cancel' | 'resume'

type CurrentPlanRenewalDialogContentProps = {
  action: RenewalAction
  renewalSource: SubscriptionRenewalSource
  endTimestamp?: number
  pending: boolean
  plain?: boolean
  onConfirm: () => void | Promise<void>
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

function getRenewalAction(
  selfData: WalletSelfSubscriptionData
): RenewalAction | null {
  if (
    selfData.capabilities.requires_support ||
    (selfData.renewal_source !== 'provider_recurring' &&
      selfData.renewal_source !== 'wallet_auto')
  ) {
    return null
  }
  if (
    selfData.renewal_status === 'enabled' &&
    selfData.capabilities.can_cancel
  ) {
    return 'cancel'
  }
  if (
    selfData.renewal_status === 'cancelled_by_user' &&
    selfData.capabilities.can_resume
  ) {
    return 'resume'
  }
  return null
}

function getRenewalBadgeLabel(action: RenewalAction): string {
  return action === 'cancel' ? 'Auto-renew on' : 'Auto-renew off'
}

function getRenewalActionLabel(action: RenewalAction): string {
  return action === 'cancel' ? 'Cancel subscription' : 'Resume subscription'
}

function getRenewalProviderCopy(
  action: RenewalAction,
  renewalSource: SubscriptionRenewalSource
): string {
  if (action === 'cancel') {
    if (renewalSource === 'provider_recurring') {
      return 'Future Stripe subscription charges stop after the current paid period.'
    }
    return 'Future deductions from your Flatkey wallet balance stop after the current paid period.'
  }
  if (renewalSource === 'provider_recurring') {
    return 'Future Stripe subscription charges resume after the current paid period.'
  }
  return 'Future deductions from your Flatkey wallet balance resume after the current paid period.'
}

export function CurrentPlanRenewalDialogContent(
  props: CurrentPlanRenewalDialogContentProps
) {
  const { t } = useTranslation()
  const title =
    props.action === 'cancel'
      ? 'Cancel automatic renewal?'
      : 'Resume automatic renewal?'
  const confirmLabel =
    props.action === 'cancel' ? 'Confirm cancellation' : 'Confirm resume'
  const hasEndTimestamp =
    typeof props.endTimestamp === 'number' && props.endTimestamp > 0

  if (props.plain) {
    return (
      <>
        <div data-slot='alert-dialog-header'>
          <h2>{t(title)}</h2>
          <p>{t(getRenewalProviderCopy(props.action, props.renewalSource))}</p>
        </div>
        {hasEndTimestamp ? (
          <p>
            {t('Your current access and benefits continue through {{date}}.', {
              date: formatTimestampToDate(props.endTimestamp),
            })}
          </p>
        ) : null}
        <div data-slot='alert-dialog-footer'>
          <Button type='button' disabled={props.pending}>
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            onClick={props.onConfirm}
            disabled={props.pending}
          >
            {t(confirmLabel)}
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{t(title)}</AlertDialogTitle>
        <AlertDialogDescription>
          {t(getRenewalProviderCopy(props.action, props.renewalSource))}
        </AlertDialogDescription>
      </AlertDialogHeader>
      {hasEndTimestamp ? (
        <p className='text-muted-foreground text-sm'>
          {t('Your current access and benefits continue through {{date}}.', {
            date: formatTimestampToDate(props.endTimestamp),
          })}
        </p>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={props.pending}>
          {t('Cancel')}
        </AlertDialogCancel>
        <AlertDialogAction onClick={props.onConfirm} disabled={props.pending}>
          {t(confirmLabel)}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  )
}

export function CurrentPlanCard(props: CurrentPlanCardProps) {
  const { t } = useTranslation()
  const [renewalDialogOpen, setRenewalDialogOpen] = useState(false)
  const start =
    props.selfData.current_period?.start ||
    props.selfData.contract?.current_period_start ||
    props.selfData.current_entitlement?.start_time
  const end =
    props.selfData.current_period?.end ||
    props.selfData.contract?.current_period_end ||
    props.selfData.current_entitlement?.end_time
  const renewalAction = getRenewalAction(props.selfData)
  const handleConfirmRenewal = async () => {
    if (!renewalAction) return
    try {
      if (renewalAction === 'cancel') {
        await props.onCancelRenewal()
      } else {
        await props.onResumeRenewal()
      }
      setRenewalDialogOpen(false)
    } catch {
      // The mutation owner shows the failure toast and keeps the dialog open.
    }
  }

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
            {renewalAction ? (
              <Badge variant='secondary'>
                {t(getRenewalBadgeLabel(renewalAction))}
              </Badge>
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

        <a
          href='/usage-logs'
          className='block rounded-lg focus-visible:outline-none focus-visible:ring-2'
        >
          <UsageWindowMeter
            label={t('Monthly model quota')}
            window={props.selfData.monthly_bucket}
            secondary
          />
        </a>

        {renewalAction && props.selfData.renewal_source ? (
          <div className='flex justify-end'>
            <AlertDialog
              open={renewalDialogOpen}
              onOpenChange={(open) => {
                if (!props.renewalMutationPending) setRenewalDialogOpen(open)
              }}
            >
              <AlertDialogTrigger
                render={
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    disabled={props.renewalMutationPending}
                  />
                }
              >
                {t(getRenewalActionLabel(renewalAction))}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <CurrentPlanRenewalDialogContent
                  action={renewalAction}
                  renewalSource={props.selfData.renewal_source}
                  endTimestamp={end}
                  pending={props.renewalMutationPending}
                  onConfirm={handleConfirmRenewal}
                />
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
