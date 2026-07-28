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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import en from '@/i18n/locales/en.json'
import { describe, expect, mock, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { QuotaSettingsSection } from './quota-settings-section'

mock.module('../components/form-navigation-guard', () => ({
  FormNavigationGuard: () => null,
}))

const i18n = createInstance()
void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: en,
  },
  interpolation: {
    escapeValue: false,
  },
})

const defaultValues = {
  QuotaForNewUser: 100,
  PreConsumedQuota: 25,
  QuotaForInviter: 777,
  QuotaForInviterMaxCount: 9,
  QuotaForInvitee: 333,
  InviteFirstSubDiscountUSD: 44,
  TopUpLink: 'https://example.com/topup',
  general_setting: {
    docs_link: 'https://docs.example.com',
  },
  quota_setting: {
    enable_free_model_pre_consume: true,
  },
}

function renderQuotaSettings(inviteRewardSubscriptionMode: boolean) {
  const queryClient = new QueryClient()

  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <QuotaSettingsSection
          defaultValues={defaultValues}
          inviteRewardSubscriptionMode={inviteRewardSubscriptionMode}
        />
      </I18nextProvider>
    </QueryClientProvider>
  )
}

function expectInputBinding(
  html: string,
  name: string,
  value: number | string
) {
  expect(html).toContain(`name="${name}"`)
  expect(html).toContain(`value="${value}"`)
}

describe('QuotaSettingsSection invitation reward modes', () => {
  test('renders legacy top-up invitee quota when subscription invitation mode is disabled', () => {
    const html = renderQuotaSettings(false)

    expect(html).toContain('Inviter Reward')
    expect(html).toContain('Invitee Reward')
    expect(html).toContain('Inviter Reward Limit')
    expect(html).toContain('Quota given to users who invite others')
    expect(html).toContain('Quota given to invited users')
    expect(html).toContain(
      'Maximum inviter rewards one account can receive. Set 0 for no limit.'
    )
    expect(html).not.toContain('Inviter subscription package credit')
    expect(html).not.toContain('Invitee first subscription package credit')
    expect(html).not.toContain('0 means unlimited.')

    expectInputBinding(html, 'QuotaForInviter', 777)
    expectInputBinding(html, 'QuotaForInvitee', 333)
    expectInputBinding(html, 'QuotaForInviterMaxCount', 9)
    expect(html).not.toContain('name="InviteFirstSubDiscountUSD"')
    expect(html).not.toContain('value="44"')
  })

  test('renders subscription invitee discount when subscription invitation mode is enabled', () => {
    const html = renderQuotaSettings(true)

    expect(html).toContain('Inviter subscription package credit')
    expect(html).toContain('Invitee first subscription package credit')
    expect(html).toContain('Reward limit')
    expect(html).toContain('0 means unlimited.')
    expect(html).not.toContain('Inviter Reward')
    expect(html).not.toContain('Invitee Reward')
    expect(html).not.toContain('Inviter Reward Limit')
    expect(html).not.toContain(
      'Maximum inviter rewards one account can receive. Set 0 for no limit.'
    )

    expectInputBinding(html, 'QuotaForInviter', 777)
    expectInputBinding(html, 'InviteFirstSubDiscountUSD', 44)
    expectInputBinding(html, 'QuotaForInviterMaxCount', 9)
    expect(html).not.toContain('name="QuotaForInvitee"')
    expect(html).not.toContain('value="333"')
  })
})
