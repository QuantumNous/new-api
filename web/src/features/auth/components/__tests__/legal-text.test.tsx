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
import { act, render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, test } from 'vitest'

import en from '@/i18n/locales/en.json'
import zh from '@/i18n/locales/zh.json'

import type { SystemStatus } from '../../types'
import { LegalConsent } from '../legal-consent'
import { TermsFooter } from '../terms-footer'

function makeI18n(language: string) {
  const i18n = createInstance()
  void i18n.init({
    lng: language,
    fallbackLng: 'en',
    resources: { en, zhCN: zh },
    nsSeparator: false,
    interpolation: { escapeValue: false },
  })
  return i18n
}

function status(userAgreement: boolean, privacyPolicy: boolean) {
  return {
    user_agreement_enabled: userAgreement,
    privacy_policy_enabled: privacyPolicy,
  } as SystemStatus
}

function renderBoth(
  language: string,
  value: SystemStatus,
  variant: 'sign-in' | 'sign-up' = 'sign-in'
) {
  const i18n = makeI18n(language)
  const view = render(
    <I18nextProvider i18n={i18n}>
      <LegalConsent status={value} checked={false} onCheckedChange={() => {}} />
      <TermsFooter status={value} variant={variant} />
    </I18nextProvider>
  )
  const consent = () =>
    view.container.querySelector('label[for="legal-consent"]')
  const footer = () => view.container.querySelector('p')
  return { i18n, consent, footer }
}

function hrefs(element: Element | null) {
  return [...(element?.querySelectorAll('a') ?? [])].map((a) =>
    a.getAttribute('href')
  )
}

describe('auth legal text localization', () => {
  test('renders whole Chinese sentences with both links', () => {
    const { consent, footer } = renderBoth('zhCN', status(true, true))
    expect(consent()?.textContent).toBe('我已阅读并同意用户协议和隐私政策。')
    expect(footer()?.textContent).toBe(
      '点击登录即表示您同意我们的用户协议和隐私政策。'
    )
    expect(hrefs(consent())).toEqual(['/user-agreement', '/privacy-policy'])
    expect(hrefs(footer())).toEqual(['/user-agreement', '/privacy-policy'])
    expect(screen.getAllByRole('link', { name: '用户协议' })).toHaveLength(2)
  })

  test('uses the sign-up sentence for the sign-up variant', () => {
    const { footer } = renderBoth('zhCN', status(true, true), 'sign-up')
    expect(footer()?.textContent).toBe(
      '创建账户即表示您同意我们的用户协议和隐私政策。'
    )
  })

  test.each([
    [true, false, '我已阅读并同意用户协议。', ['/user-agreement']],
    [false, true, '我已阅读并同意隐私政策。', ['/privacy-policy']],
  ])(
    'renders only the enabled document (agreement=%s, privacy=%s)',
    (userAgreement, privacyPolicy, text, links) => {
      const { consent, footer } = renderBoth(
        'zhCN',
        status(userAgreement, privacyPolicy)
      )
      expect(consent()?.textContent).toBe(text)
      expect(hrefs(footer())).toEqual(links)
    }
  )

  test('renders nothing when no document is enabled', () => {
    const { consent, footer } = renderBoth('zhCN', status(false, false))
    expect(consent()).toBeNull()
    expect(footer()).toBeNull()
  })

  test('updates the text when the language changes', async () => {
    const { i18n, consent, footer } = renderBoth('en', status(true, true))
    expect(consent()?.textContent).toBe(
      'I have read and agree to the User Agreement and Privacy Policy.'
    )
    await act(() => i18n.changeLanguage('zhCN'))
    expect(consent()?.textContent).toBe('我已阅读并同意用户协议和隐私政策。')
    expect(footer()?.textContent).toBe(
      '点击登录即表示您同意我们的用户协议和隐私政策。'
    )
  })
})
