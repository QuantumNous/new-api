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
import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import type { ProfileSubscriptionSummary } from '../lib'
import type { UserProfile } from '../types'
import { ProfileHeader } from './profile-header'

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

const profile: UserProfile = {
  id: 42,
  username: 'ada',
  display_name: 'Ada Lovelace',
  role: 1,
  email: 'ada@example.com',
  group: 'default',
  quota: 1500000,
  used_quota: 250000,
  request_count: 1234,
  status: 1,
  aff_count: 0,
  aff_quota: 0,
  aff_history_quota: 0,
  created_time: 1710000000,
}

function renderHeader(subscription: ProfileSubscriptionSummary | null): string {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <ProfileHeader
        profile={profile}
        loading={false}
        subscription={subscription}
      />
    </I18nextProvider>
  )
}

function extractBalanceGuidance(html: string): string {
  const match = html.match(
    /<div[^>]*data-slot="profile-balance-guidance"[^>]*>[\s\S]*?<\/div>/
  )
  return match?.[0] ?? ''
}

describe('ProfileHeader', () => {
  test('renders an active subscription panel beside the compact balance guidance', () => {
    const subscription: ProfileSubscriptionSummary = {
      planTitle: 'Pro',
      totalQuota: 5000000,
      usedQuota: 1900000,
      remainingQuota: 3100000,
      unlimited: false,
      remainingDays: 19,
      usagePercent: 38,
    }

    const html = renderHeader(subscription)

    expect(html).toContain('aria-label="Current Plan"')
    expect(html).toContain('data-slot="profile-plan-summary"')
    expect(html).toContain('Pro')
    expect(html).toContain('Active')
    expect(html).not.toContain('Click to copy: Active')
    expect(html).toContain('Remaining days')
    expect(html).toContain('19')
    expect(html).toContain('Monthly model quota')
    expect(html).toContain(formatQuota(subscription.totalQuota))
    expect(html).toContain('Remaining')
    expect(html).toContain(formatQuota(subscription.remainingQuota))
    expect(html).toContain('aria-label="Progress"')
    expect(html).toContain('aria-valuenow="38"')
    expect(html).toContain('Available balance')
    expect(html).toContain(formatQuota(profile.quota))
    expect(html).toContain('Balance can be used to purchase plans directly.')
    expect(html).toContain(
      'After plan quota is exhausted, balance is used automatically for API usage billing.'
    )
    expect(html).toContain('Total Usage')
    expect(html).toContain('API Requests')
  })

  test('does not render a subscription placeholder when no summary exists', () => {
    const html = renderHeader(null)

    expect(html).not.toContain('profile-plan-summary')
    expect(html).not.toContain('Pro')
    expect(html).not.toContain('No plan')
    expect(html).not.toContain('未订阅')
    expect(html).toContain('Ada Lovelace')
    expect(html).toContain('Available balance')
    expect(html).toContain(formatQuota(profile.quota))
    expect(html).toContain('Total Usage')
    expect(html).toContain('API Requests')
  })

  test('renders two complete balance guidance paragraphs without clipping utilities', () => {
    const html = renderHeader(null)
    const guidance = extractBalanceGuidance(html)

    expect(guidance).not.toBe('')
    expect((guidance.match(/<p/g) ?? []).length).toBe(2)
    expect(guidance).toMatch(
      /<p[^>]*>Balance can be used to purchase plans directly\.<\/p>[\s\S]*<p[^>]*>After plan quota is exhausted, balance is used automatically for API usage billing\.<\/p>/
    )
    expect(guidance).not.toContain('truncate')
    expect(guidance).not.toContain('line-clamp')
  })

  test('renders unlimited subscription quota without a finite usage percentage', () => {
    const subscription: ProfileSubscriptionSummary = {
      planTitle: 'Scale',
      totalQuota: 0,
      usedQuota: 0,
      remainingQuota: 0,
      unlimited: true,
      remainingDays: null,
      usagePercent: 0,
    }

    const html = renderHeader(subscription)

    expect(html).toContain('Unlimited')
    expect(html).toContain('aria-valuenow="0"')
    expect(html).toContain('aria-valuetext="Unlimited"')
    expect(html).not.toContain('aria-valuetext="0%"')
  })
})
