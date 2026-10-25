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
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'

import type { CashbackPublicOffer } from '@/features/cashback/types'

import { buildRewardBannerContent } from '../lib/banner-content'

const options = {
  t: i18next.t.bind(i18next),
  locale: 'en-US',
  formatQuota: (quota: number) => `Q${quota}`,
}
const tiered: CashbackPublicOffer = {
  strategy: 'tiered',
  tiers: [
    { threshold_cents: 10_000, reward_cents: 500 },
    { threshold_cents: 30_050, reward_cents: 800 },
  ],
}

describe('buildRewardBannerContent', () => {
  it('lists every tier with first top-up wording for a first-top-up campaign', () => {
    const content = buildRewardBannerContent(
      {
        signupQuota: 0,
        registerEnabled: true,
        payerOffer: { ...tiered, payer_scope: 'first_top_up' },
      },
      options
    )

    expect(content?.segments).toEqual([
      'First top-up ¥100 get ¥5 · ¥300.50 get ¥8',
    ])
  })

  it('uses every-order wording when the offer has no payer scope', () => {
    const content = buildRewardBannerContent(
      { signupQuota: 0, registerEnabled: true, payerOffer: tiered },
      options
    )

    expect(content?.segments).toEqual(['Top up ¥100 get ¥5 · ¥300.50 get ¥8'])
  })

  it('describes per-hundred and rate offers in yuan and percent', () => {
    const perHundred = buildRewardBannerContent(
      {
        signupQuota: 0,
        registerEnabled: true,
        payerOffer: {
          strategy: 'per_hundred',
          fixed_per_hundred: 3,
          payer_scope: 'first_top_up',
        },
      },
      options
    )
    const rate = buildRewardBannerContent(
      {
        signupQuota: 0,
        registerEnabled: true,
        payerOffer: { strategy: 'rate', rate_bps: 550 },
      },
      options
    )

    expect(perHundred?.segments).toEqual(['First top-up: ¥3 for every ¥100'])
    expect(rate?.segments).toEqual(['Top-up: 5.5% back'])
  })

  it('puts the sign-up grant first when registration is open', () => {
    const content = buildRewardBannerContent(
      { signupQuota: 1500, registerEnabled: true, payerOffer: tiered },
      options
    )

    expect(content?.segments[0]).toBe('New users get Q1500 on sign-up')
    expect(content?.segments).toHaveLength(2)
  })

  it('shows only the sign-up grant when no campaign is running', () => {
    const content = buildRewardBannerContent(
      { signupQuota: 1500, registerEnabled: true },
      options
    )

    expect(content?.segments).toEqual(['New users get Q1500 on sign-up'])
  })

  it('returns null when registration is closed and no campaign is running', () => {
    expect(
      buildRewardBannerContent(
        { signupQuota: 1500, registerEnabled: false },
        options
      )
    ).toBeNull()
    expect(
      buildRewardBannerContent(
        {
          signupQuota: 0,
          registerEnabled: true,
          payerOffer: { strategy: 'tiered', tiers: [] },
        },
        options
      )
    ).toBeNull()
  })

  it('keeps the same rules key across languages but changes it with the rules', () => {
    const rules = {
      signupQuota: 1500,
      registerEnabled: true,
      payerOffer: tiered,
    }
    const english = buildRewardBannerContent(rules, options)
    const chinese = buildRewardBannerContent(rules, {
      ...options,
      locale: 'zh-CN',
    })
    const changed = buildRewardBannerContent(
      { ...rules, payerOffer: { ...tiered, payer_scope: 'first_top_up' } },
      options
    )

    expect(chinese?.rulesKey).toBe(english?.rulesKey)
    expect(changed?.rulesKey).not.toBe(english?.rulesKey)
  })
})
