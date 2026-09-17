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
import { render, screen } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { PricingSection } from '../pricing-section'

vi.mock('../../components/form-navigation-guard', () => ({
  FormNavigationGuard: () => null,
}))

const labels = {
  'Pricing & Display': 'Pricing & Display',
  'Display Mode': 'Display Mode',
  'CNY per USD': 'CNY per USD',
  'USD Exchange Rate': 'USD Exchange Rate',
  'Units per USD': 'Units per USD',
  'Custom Currency Symbol': 'Custom Currency Symbol',
  'Real exchange rate between USD and your payment gateway currency':
    'Real exchange rate between USD and your payment gateway currency',
  'Conversion rate from USD to your custom currency':
    'Conversion rate from USD to your custom currency',
  'Display Token Statistics': 'Display Token Statistics',
  'Show token usage statistics in the UI':
    'Show token usage statistics in the UI',
  USD: 'USD',
  CNY: 'CNY',
  'Custom Currency': 'Custom Currency',
  'Tokens Only': 'Tokens Only',
  'Select display mode': 'Select display mode',
  'Choose how quota values are shown to users':
    'Choose how quota values are shown to users',
  Save: 'Save',
  Reset: 'Reset',
}

function Harness(props: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      })
  )
  return (
    <QueryClientProvider client={client}>
      <div ref={setContainer} />
      <SettingsPageProvider actionsContainer={container}>
        {props.children}
      </SettingsPageProvider>
    </QueryClientProvider>
  )
}

describe('exchange rate input step', () => {
  beforeEach(async () => {
    const { default: i18next } = await import('i18next')
    i18next.addResourceBundle('en', 'translation', labels, true, true)
  })

  it('uses an HTML step fine enough for multi-decimal rates such as 6.7081', () => {
    render(
      <Harness>
        <PricingSection
          defaultValues={{
            QuotaPerUnit: 500000,
            USDExchangeRate: 6.7081,
            DisplayInCurrencyEnabled: true,
            DisplayTokenStatEnabled: true,
            general_setting: {
              quota_display_type: 'CNY',
              custom_currency_symbol: '',
              custom_currency_exchange_rate: undefined,
            },
          }}
        />
      </Harness>
    )

    const rateInput = screen.getByRole('spinbutton', { name: 'CNY per USD' })
    expect(rateInput).toHaveValue(6.7081)
    // step must match zod min(0.0001); step="0.01" makes browsers flag 6.7081
    expect(rateInput).toHaveAttribute('step', '0.0001')
    expect(isHtmlStepMismatch(6.7081, rateInput.getAttribute('step'))).toBe(
      false
    )
  })

  it('keeps custom currency units-per-USD step aligned with multi-decimal rates', () => {
    render(
      <Harness>
        <PricingSection
          defaultValues={{
            QuotaPerUnit: 500000,
            USDExchangeRate: 1,
            DisplayInCurrencyEnabled: true,
            DisplayTokenStatEnabled: true,
            general_setting: {
              quota_display_type: 'CUSTOM',
              custom_currency_symbol: 'HK$',
              custom_currency_exchange_rate: 7.8493,
            },
          }}
        />
      </Harness>
    )

    const customRateInput = screen.getByRole('spinbutton', {
      name: 'Units per USD',
    })
    expect(customRateInput).toHaveValue(7.8493)
    expect(customRateInput).toHaveAttribute('step', '0.0001')
    expect(
      isHtmlStepMismatch(7.8493, customRateInput.getAttribute('step'))
    ).toBe(false)
  })
})

/** Mirrors HTML5 number step mismatch: (value - min) must be an integer multiple of step. */
function isHtmlStepMismatch(
  value: number,
  stepAttr: string | null,
  min = 0
): boolean {
  if (stepAttr == null || stepAttr === 'any') return false
  const step = Number(stepAttr)
  if (!Number.isFinite(step) || step <= 0) return false
  const n = (value - min) / step
  return Math.abs(n - Math.round(n)) > 1e-8
}
