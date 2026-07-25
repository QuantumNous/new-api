/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useTranslation } from 'react-i18next'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import { formatInvitationUSD } from '../lib/usd'
import type { InvitationSummary } from '../types'

interface InvitationFaqProps {
  summary: InvitationSummary | null
}

export function InvitationFaq({ summary }: InvitationFaqProps) {
  const { t } = useTranslation()
  if (summary === null) {
    return (
      <TitledCard title={t('FAQ')}>
        <div className='space-y-3'>
          <Skeleton className='h-9 w-full' />
          <Skeleton className='h-9 w-full' />
          <Skeleton className='h-9 w-full' />
        </div>
      </TitledCard>
    )
  }

  const inviterReward = formatInvitationUSD(summary.inviter_reward_usd)
  const inviteeReward = formatInvitationUSD(summary.invitee_reward_usd)
  const limit = summary.inviter_reward_max_count
  const subscriptionMode = summary.reward_mode === 'subscription'
  const subDiscount = formatInvitationUSD(summary.first_sub_discount_usd)
  const items = [
    subscriptionMode
      ? {
          question: t('When are referral rewards granted?'),
          answer: t(
            "Referral rewards are created when your friend completes their first subscription payment, and unlock {{days}} days later if the payment is not refunded. Registration, top-ups, and API calls alone do not grant a reward.",
            { days: summary.unlock_delay_days }
          ),
        }
      : {
          question: t('When are referral rewards granted?'),
          answer: t(
            'Referral rewards are granted only after your friend completes their first successful top-up. Registration, creating an API key, and making an API call do not grant a reward.'
          ),
        },
    subscriptionMode
      ? {
          question: t('What are the current referral rewards?'),
          answer: t(
            'Your friend gets {{discount}} off the first month of any plan, and you receive {{reward}} as balance.',
            { discount: subDiscount, reward: inviterReward }
          ),
        }
      : {
          question: t('What are the current referral rewards?'),
          answer: t(
            "The current configured rewards are {{inviterReward}} for you and {{inviteeReward}} for your friend. Rewards are processed after your friend's first successful top-up.",
            { inviterReward, inviteeReward }
          ),
        },
    {
      question: t('Is there a referral reward limit?'),
      answer:
        limit === 0
          ? t(
              'There is currently no limit on the number of referral rewards you can earn.'
            )
          : t(
              'The maximum number of successful referrals you can earn rewards for is {{count}}. Friends invited after that can still receive their reward.',
              { count: limit }
            ),
    },
    {
      question: t('How do I use my referral rewards?'),
      answer: t(
        'Referral rewards are added automatically to your API balance and used for API requests.'
      ),
    },
    {
      question: t('Which referrals appear here?'),
      answer: t(
        'This list shows active accounts registered through your referral link. Deleted accounts may not appear, so the rewards shown here may not add up to your lifetime earnings.'
      ),
    },
    {
      question: t('What behavior is prohibited?'),
      answer: t(
        'Self-referrals, duplicate accounts, and other abuse are prohibited. Rewards may be withheld or revoked.'
      ),
    },
  ]

  return (
    <TitledCard title={t('FAQ')}>
      <Accordion>
        {items.map((item, index) => (
          <AccordionItem key={item.question} value={`item-${index}`}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent className='text-muted-foreground'>
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </TitledCard>
  )
}
