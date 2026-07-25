/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import { formatInvitationUSD } from '../lib/usd'
import type { InvitationSummary } from '../types'

interface RewardStepsCardProps {
  summary: InvitationSummary | null
}

export function RewardStepsCard(props: RewardStepsCardProps) {
  const { t } = useTranslation()
  const subscriptionMode = props.summary?.reward_mode === 'subscription'
  let rewardTitle: string | null = null
  if (props.summary !== null) {
    if (subscriptionMode) {
      rewardTitle = t('You receive {{reward}} in balance', {
        reward: formatInvitationUSD(props.summary.inviter_reward_usd),
      })
    } else if (
      props.summary.inviter_reward_usd === props.summary.invitee_reward_usd
    ) {
      rewardTitle = t('Both receive {{reward}}', {
        reward: formatInvitationUSD(props.summary.inviter_reward_usd),
      })
    } else {
      rewardTitle = t(
        'You receive {{inviterReward}}, your friend receives {{inviteeReward}}',
        {
          inviterReward: formatInvitationUSD(props.summary.inviter_reward_usd),
          inviteeReward: formatInvitationUSD(props.summary.invitee_reward_usd),
        }
      )
    }
  }
  const steps = subscriptionMode
    ? [
        {
          title: t('Share your referral link'),
          description: t('Send your unique referral link to a friend.'),
        },
        {
          title: t('Your friend subscribes with {{discount}} off', {
            discount: formatInvitationUSD(
              props.summary?.first_sub_discount_usd ?? 5
            ),
          }),
          description: t(
            'They sign up with your link and get {{discount}} off the first month of any plan.',
            {
              discount: formatInvitationUSD(
                props.summary?.first_sub_discount_usd ?? 5
              ),
            }
          ),
        },
        {
          title: rewardTitle,
          description: t(
            '{{reward}} is added to your balance, unlocked {{days}} days after payment if there is no refund.',
            {
              reward: formatInvitationUSD(
                props.summary?.inviter_reward_usd ?? 0
              ),
              days: props.summary?.unlock_delay_days ?? 7,
            }
          ),
        },
      ]
    : [
        {
          title: t('Share your referral link'),
          description: t('Send your unique referral link to a friend.'),
        },
        {
          title: t('Your friend signs up and tops up'),
          description: t(
            'They create their account using your referral link and complete their first successful top-up.'
          ),
        },
        {
          title: rewardTitle,
          description: t(
            'Rewards are added automatically to both API balances and used for API requests.'
          ),
        },
      ]

  return (
    <TitledCard title={t('How it works')}>
      <ol className='grid gap-4 md:grid-cols-3'>
        {steps.map((step, index) => (
          <li key={index} className='flex min-w-0 gap-3'>
            <span className='bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums'>
              {index + 1}
            </span>
            <div className='min-w-0'>
              {step.title === null ? (
                <Skeleton className='h-5 w-32' />
              ) : (
                <h3 className='font-medium'>{step.title}</h3>
              )}
              <p className='text-muted-foreground mt-1 text-sm'>
                {step.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </TitledCard>
  )
}
