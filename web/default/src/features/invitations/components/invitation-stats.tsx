/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatInvitationUSD } from '../lib/usd'
import type { InvitationSummary } from '../types'

interface InvitationStatsProps {
  summary: InvitationSummary | null
  registeredCount: number
  loading: boolean
}

export function InvitationStats(props: InvitationStatsProps) {
  const { t } = useTranslation()
  const summary = props.summary
  const pending = props.loading || summary === null
  const hasPendingReferrals = (summary?.pending_count ?? 0) > 0
  const subscriptionMode = summary?.reward_mode === 'subscription'
  const stats =
    summary?.reward_mode === 'subscription'
      ? [
          {
            label: t('Available package discount'),
            value: formatInvitationUSD(summary.available_discount_usd),
            description: t('For package purchases and renewals'),
          },
          {
            label: t('Lifetime package discount'),
            value: formatInvitationUSD(summary.lifetime_discount_usd),
            description: t('Permanent total earned'),
          },
        ]
      : [
          {
            label: t('Total earned'),
            value: formatInvitationUSD(
              summary?.reward_mode === 'topup' ? summary.history_usd : 0
            ),
            description: t('Lifetime'),
          },
          {
            label: t('Pending credits'),
            value: formatInvitationUSD(
              summary?.reward_mode === 'topup' ? summary.pending_reward_usd : 0
            ),
            description: t("Released after your friend's first top-up"),
          },
        ]
  stats.push(
    {
      label: t('Registered friends'),
      value: String(props.registeredCount),
      description: subscriptionMode
        ? t('Friends get {{reward}} package discount', {
            reward: formatInvitationUSD(summary?.invitee_reward_usd ?? 0),
          })
        : t('{{reward}} each after first top-up', {
            reward: formatInvitationUSD(summary?.inviter_reward_usd ?? 0),
          }),
    },
    {
      label: t('Status'),
      value: hasPendingReferrals ? t('Active') : '--',
      description: hasPendingReferrals
        ? t('Tracking')
        : t('Share your link to start earning'),
    }
  )

  return (
    <Card size='sm' className='py-0'>
      <div className='divide-border grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4'>
        {stats.map((stat) => (
          <div key={stat.label} className='px-4 py-4 sm:px-5'>
            <p className='text-muted-foreground text-xs font-medium'>
              {stat.label}
            </p>
            {pending ? (
              <Skeleton className='mt-2 h-7 w-24' />
            ) : (
              <p className='mt-2 text-2xl font-semibold tabular-nums'>
                {stat.value}
              </p>
            )}
            {!pending && (
              <p className='text-muted-foreground mt-1 text-xs'>
                {stat.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
