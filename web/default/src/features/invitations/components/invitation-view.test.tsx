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
import type { ComponentProps } from 'react'
import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { InvitationView } from '../index'
import { formatInvitationUSD } from '../lib/usd'
import type { InvitationPageData } from '../types'

const testI18n = createInstance()

const fixture: InvitationPageData = {
  summary: {
    inviter_reward_usd: 1,
    invitee_reward_usd: 0.5,
    inviter_reward_max_count: 10,
    history_usd: 3,
    pending_reward_usd: 2,
    granted_count: 3,
    pending_count: 2,
  },
  items: [
    {
      id: 1,
      masked_identity: 'a***@example.com',
      registered_at: 1783612800,
      status: 'granted',
      granted_at: 1783699200,
      reward_usd: 1,
      reason: '',
    },
    {
      id: 2,
      masked_identity: 'b***@example.com',
      registered_at: 1783526400,
      status: 'pending',
      granted_at: 0,
      reward_usd: 0,
      reason: '',
    },
  ],
  page: 1,
  page_size: 10,
  total: 12,
}

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

function renderView(
  overrides: Partial<ComponentProps<typeof InvitationView>> = {}
): string {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <InvitationView
        data={fixture}
        affiliateLink='https://console.example.com/sign-up?aff=ABCD'
        loading={false}
        recordsLoading={false}
        affiliateLoading={false}
        affiliateError={false}
        error={false}
        page={1}
        onPageChange={() => undefined}
        onRetry={() => undefined}
        {...overrides}
      />
    </I18nextProvider>
  )
}

describe('InvitationView', () => {
  test('explains and renders the populated first-top-up reward flow', () => {
    const html = renderView()

    expect(html).toContain('Total earned')
    expect(html).toContain('Pending credits')
    expect(html).toContain('Registered friends')
    expect(html).toContain('Active')
    expect(html).toContain('Your Referral Link')
    expect(html).toContain('https://console.example.com/sign-up?aff=ABCD')
    expect(html).toContain('Share by email')
    expect(html).toContain('Share on X')
    expect(html).toContain('Share on LinkedIn')
    expect(html).toContain('Share your referral link')
    expect(html).toContain('Your friend signs up')
    expect(html).toContain('first successful top-up')
    expect(html).toContain('You receive $1, your friend receives $0.5')
    expect(html).toContain(
      'Rewards are added automatically to both API balances and used for API requests.'
    )
    expect(html).toContain('$3')
    expect(html).toContain('$2')
    expect(html).toContain('12')
    expect(html).toContain('Recent referrals')
    expect(html).toContain('a***@example.com')
    expect(html).toContain('Reward granted')
    expect(html).toContain('Awaiting top-up')
    expect(html).not.toContain('first API key')
    expect(html).not.toContain('successfully calls the API')
    expect(html).not.toContain('Available to transfer')
    expect(html).not.toContain('Transfer Rewards')
  })

  test('shows equal configured rewards and an unlimited configured referral count below the title', () => {
    const html = renderView({
      data: {
        ...fixture,
        summary: {
          ...fixture.summary,
          inviter_reward_usd: 20,
          invitee_reward_usd: 20,
          inviter_reward_max_count: 0,
        },
      },
    })

    expect(html).toContain('you both receive $20 in API credits')
    expect(html).toContain('Both receive $20')
    expect(html).toContain('Unlimited rewards')
  })

  test('shows separate configured rewards and the configured referral limit', () => {
    const html = renderView({
      data: {
        ...fixture,
        summary: {
          ...fixture.summary,
          inviter_reward_usd: 20,
          invitee_reward_usd: 10,
          inviter_reward_max_count: 7,
        },
      },
    })

    expect(html).toContain('You receive $20')
    expect(html).toContain('your friend receives $10 in API credits')
    expect(html).toContain('You receive $20, your friend receives $10')
    expect(html).toContain('up to 7 successful referrals')
    expect(html).not.toContain('Unlimited rewards')
  })

  test('renders the empty invitation state', () => {
    const html = renderView({
      data: {
        ...fixture,
        summary: {
          ...fixture.summary,
          pending_reward_usd: 0,
          pending_count: 0,
        },
        items: [],
        total: 0,
      },
    })

    expect(html).toContain('No referrals yet')
    expect(html).toContain('Share your referral link to get started.')
    expect(html).toContain('>--<')
    expect(html).toContain('Share your link to start earning')
    expect(html).not.toContain('Active')
    expect(html).not.toContain('Tracking')
    expect(html).not.toContain('Previous')
  })

  test('returns the status card to the earning prompt after every referral is rewarded', () => {
    const html = renderView({
      data: {
        ...fixture,
        summary: {
          ...fixture.summary,
          pending_reward_usd: 0,
          pending_count: 0,
        },
      },
    })

    expect(html).toContain('>--<')
    expect(html).toContain('Share your link to start earning')
    expect(html).not.toContain('Active')
    expect(html).not.toContain('Tracking')
  })

  test('lets users return from an empty later page', () => {
    const html = renderView({
      data: { ...fixture, items: [], page: 2 },
      page: 2,
    })

    expect(html).toContain('No referrals yet')
    expect(html).toContain('Previous')
  })

  test('renders a retry action when invitation records fail', () => {
    const html = renderView({ data: null, error: true })

    expect(html).toContain('load your referrals.')
    expect(html).toContain('Retry')
    expect(html).not.toContain('Previous')
  })

  test('lets users retry or return when a later page fails', () => {
    const html = renderView({ data: null, error: true, page: 2 })

    expect(html).toContain('load your referrals.')
    expect(html).toContain('Retry')
    expect(html).toContain('Previous')
  })

  test('keeps a limit-reached invitation granted with an explicit explanation', () => {
    const html = renderView({
      data: {
        ...fixture,
        items: [
          {
            ...fixture.items[0],
            reward_usd: 0,
            reason: 'inviter_limit_reached',
          },
        ],
        total: 1,
      },
    })

    expect(html).toContain('Reward granted')
    expect(html).toContain('You reached the referral reward limit')
  })

  test('renders loading placeholders without empty or error copy', () => {
    const html = renderView({ data: null, loading: true })

    expect(html).toContain('data-slot="skeleton"')
    expect(html).toContain('max-w-3xl')
    expect(html).not.toContain('No referrals yet')
    expect(html).not.toContain('load your referrals.')
    expect(html).not.toMatch(/>\$?0</)
    expect(html).not.toContain(
      'There is currently no limit on the number of referral rewards you can earn.'
    )
    expect(html).not.toContain('you both receive')
    expect(html).not.toContain('You receive')
    expect(html).not.toContain('Unlimited rewards')
    expect(html).not.toContain('What are the current referral rewards?')
    expect(html).not.toContain('Is there a referral reward limit?')
    expect(html).not.toContain(
      'Referral reward transfer is disabled until the administrator confirms compliance terms.'
    )
  })

  test('keeps summary content while paginated records load', () => {
    const html = renderView({ recordsLoading: true })

    expect(html).toContain('Total earned')
    expect(html).toContain('What are the current referral rewards?')
    expect(html).toContain('data-slot="skeleton"')
    expect(html).not.toContain('a***@example.com')
    expect(html).not.toContain('No referrals yet')
  })

  test('uses local-only pagination links', () => {
    const html = renderView()

    expect(html).toContain('href="#"')
    expect(html).not.toContain('?page=')
  })

  test('does not fabricate summary facts when invitation loading fails', () => {
    const html = renderView({ data: null, loading: false, error: true })

    expect(html).toContain('data-slot="skeleton"')
    expect(html).not.toContain('max-w-3xl')
    expect(html).not.toMatch(/>\$?0</)
    expect(html).not.toContain(
      'There is currently no limit on the number of referral rewards you can earn.'
    )
    expect(html).not.toContain('you both receive')
    expect(html).not.toContain('You receive')
    expect(html).not.toContain('Unlimited rewards')
    expect(html).not.toContain('How it works')
    expect(html).not.toContain('Rewards are added automatically')
    expect(html).not.toContain('What are the current referral rewards?')
    expect(html).not.toContain('Is there a referral reward limit?')
    expect(html).not.toContain(
      'Referral reward transfer is disabled until the administrator confirms compliance terms.'
    )
  })

  test('keeps records usable when only the referral link fails', () => {
    const html = renderView({
      affiliateLink: '',
      affiliateError: true,
    })

    expect(html).toContain('Failed to load: Your Referral Link')
    expect(html).not.toContain('load your referrals.')
    expect(html).toContain('a***@example.com')
    expect(html).not.toContain('Copy referral link')
  })

  test('renders accessible icon anchors for every share target', () => {
    const html = renderView()

    expect(html).toMatch(
      /<a[^>]*aria-label="Share by email"[^>]*>\s*<svg[^>]*>/
    )
    expect(html).toMatch(
      /<a[^>]*aria-label="Share on X"[^>]*target="_blank"[^>]*rel="noreferrer noopener"[^>]*>\s*<svg[^>]*>/
    )
    expect(html).toMatch(
      /<a[^>]*aria-label="Share on LinkedIn"[^>]*target="_blank"[^>]*rel="noreferrer noopener"[^>]*>\s*<svg[^>]*>/
    )
  })

  test('uses Flatkey in the referral share message', () => {
    const html = renderView()
    const message = encodeURIComponent(
      'Join Flatkey with my referral link. Referral rewards are processed after your first successful top-up.'
    )

    expect(html).toContain(message)
    expect(html).not.toContain('Join%20NewAPI%20with%20my%20referral%20link')
  })
})

describe('USD formatting', () => {
  test('keeps sub-dollar USD precision visible instead of rounding across a boundary', () => {
    expect(formatInvitationUSD(0.999)).toBe('$0.999')
    expect(formatInvitationUSD(0.000002)).toBe('$0.000002')
  })
})
