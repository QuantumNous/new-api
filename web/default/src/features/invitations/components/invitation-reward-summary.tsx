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
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { formatInvitationUSD } from '../lib/usd'
import type { InvitationSummary } from '../types'

interface InvitationRewardSummaryProps {
  summary: InvitationSummary | null
}

export function InvitationRewardSummary(props: InvitationRewardSummaryProps) {
  const { t } = useTranslation()

  if (props.summary === null) {
    return <Skeleton className='h-4 w-full max-w-3xl' />
  }

  const inviterReward = formatInvitationUSD(props.summary.inviter_reward_usd)
  const inviteeReward = formatInvitationUSD(props.summary.invitee_reward_usd)
  const sameReward =
    props.summary.inviter_reward_usd === props.summary.invitee_reward_usd

  let rewardCopy: string
  if (props.summary.reward_mode === 'subscription') {
    rewardCopy = t(
      'Invite friends to subscribe: they get {{discount}} off their first month, and you receive {{reward}} in balance — unlocked {{days}} days after payment.',
      {
        discount: formatInvitationUSD(props.summary.first_sub_discount_usd),
        reward: inviterReward,
        days: props.summary.unlock_delay_days,
      }
    )
  } else if (sameReward) {
    rewardCopy = t(
      'Invite friends to sign up and complete their first top-up, and you both receive {{reward}} in API credits.',
      { reward: inviterReward }
    )
  } else {
    rewardCopy = t(
      'Invite friends to sign up and complete their first top-up. You receive {{inviterReward}} and your friend receives {{inviteeReward}} in API credits.',
      { inviterReward, inviteeReward }
    )
  }

  const rewardLimit = props.summary.inviter_reward_max_count
  let limitCopy: string
  if (rewardLimit === 0) {
    limitCopy = t(
      'Unlimited rewards, credits never expire, and any email address is accepted.'
    )
  } else if (rewardLimit === 1) {
    limitCopy = t(
      'Earn rewards for up to {{count}} successful referral. Credits never expire, and any email address is accepted.',
      { count: rewardLimit }
    )
  } else {
    limitCopy = t(
      'Earn rewards for up to {{count}} successful referrals. Credits never expire, and any email address is accepted.',
      { count: rewardLimit }
    )
  }

  return (
    <p className='text-muted-foreground text-sm'>
      {rewardCopy} {limitCopy}
    </p>
  )
}
