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
import type { TFunction } from 'i18next'

import { formatCashbackCents } from '@/features/cashback/lib/format'
import type { CashbackPublicOffer } from '@/features/cashback/types'
import { formatNumber } from '@/lib/format'

export type RewardBannerRules = {
  /** Wallet quota granted on registration; shown only while sign-up is open. */
  signupQuota: number
  registerEnabled: boolean
  /** Live payer offer, or undefined when no campaign is running. */
  payerOffer?: CashbackPublicOffer
}

export type RewardBannerContent = {
  segments: string[]
  /** Identifies the rules (not the language) so a dismissal survives i18n. */
  rulesKey: string
}

type FormatOptions = {
  t: TFunction
  locale?: Intl.LocalesArgument
  formatQuota: (quota: number) => string
}

function describePayerOffer(
  offer: CashbackPublicOffer,
  options: FormatOptions
): string | null {
  const t = options.t
  const firstTopUp = offer.payer_scope === 'first_top_up'
  const yuan = (cents: number) =>
    formatCashbackCents(cents, options.locale, { wholeYuan: true })

  if (offer.strategy === 'tiered') {
    if (!offer.tiers?.length) return null
    const tiers = offer.tiers
      .map((tier) =>
        t('{{threshold}} get {{reward}}', {
          threshold: yuan(tier.threshold_cents),
          reward: yuan(tier.reward_cents),
        })
      )
      .join(' · ')
    return firstTopUp
      ? t('First top-up {{tiers}}', { tiers })
      : t('Top up {{tiers}}', { tiers })
  }
  if (offer.strategy === 'per_hundred') {
    const fixed = offer.fixed_per_hundred ?? 0
    if (fixed <= 0) return null
    const values = { reward: yuan(fixed * 100), step: yuan(10_000) }
    return firstTopUp
      ? t('First top-up: {{reward}} for every {{step}}', values)
      : t('Top-up: {{reward}} for every {{step}}', values)
  }
  const rateBps = offer.rate_bps ?? 0
  if (rateBps <= 0) return null
  const percent = `${formatNumber(rateBps / 100, options.locale)}%`
  return firstTopUp
    ? t('First top-up: {{percent}} back', { percent })
    : t('Top-up: {{percent}} back', { percent })
}

/** Banner copy generated only from live rules; null when nothing is on offer. */
export function buildRewardBannerContent(
  rules: RewardBannerRules,
  options: FormatOptions
): RewardBannerContent | null {
  const segments: string[] = []
  const signupQuota =
    rules.registerEnabled && rules.signupQuota > 0 ? rules.signupQuota : 0
  if (signupQuota > 0) {
    segments.push(
      options.t('New users get {{amount}} on sign-up', {
        amount: options.formatQuota(signupQuota),
      })
    )
  }
  const offerText = rules.payerOffer
    ? describePayerOffer(rules.payerOffer, options)
    : null
  if (offerText) segments.push(offerText)
  if (segments.length === 0) return null

  return {
    segments,
    rulesKey: JSON.stringify({
      signupQuota,
      offer: offerText ? rules.payerOffer : null,
    }),
  }
}
