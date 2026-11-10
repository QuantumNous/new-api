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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { PaymentSettingsSection } from '../payment-settings-section'

type PaymentProps = ComponentProps<typeof PaymentSettingsSection>
type PaymentValues = PaymentProps['defaultValues']

const defaults: PaymentValues = {
  PayAddress: 'https://pay.example.com',
  EpayId: '1001',
  EpayKey: '',
  EpaySignType: 'MD5',
  EpayMerchantPrivateKey: '',
  EpayPlatformPublicKey: '',
  Price: 7.3,
  MinTopUp: 1,
  CustomCallbackAddress: '',
  PayMethods: '[]',
  AmountOptions: '[]',
  AmountDiscount: '{}',
  StripeApiSecret: '',
  StripeWebhookSecret: '',
  StripePriceId: '',
  StripeUnitPrice: 8,
  StripeMinTopUp: 1,
  StripePromotionCodesEnabled: false,
  CreemApiKey: '',
  CreemWebhookSecret: '',
  CreemTestMode: false,
  CreemProducts: '[]',
}

function PaymentFixture(props: { values: PaymentValues }) {
  const [actions, setActions] = useState<HTMLDivElement | null>(null)
  return (
    <SettingsPageProvider actionsContainer={actions}>
      <div ref={setActions} />
      <PaymentSettingsSection
        defaultValues={props.values}
        waffoDefaultValues={{
          WaffoEnabled: false,
          WaffoApiKey: '',
          WaffoPrivateKey: '',
          WaffoPublicCert: '',
          WaffoSandboxPublicCert: '',
          WaffoSandboxApiKey: '',
          WaffoSandboxPrivateKey: '',
          WaffoSandbox: false,
          WaffoMerchantId: '',
          WaffoCurrency: 'USD',
          WaffoUnitPrice: 1,
          WaffoMinTopUp: 1,
          WaffoNotifyUrl: '',
          WaffoReturnUrl: '',
          WaffoPayMethods: '[]',
        }}
        waffoPancakeDefaultValues={{
          WaffoPancakeMerchantID: '',
          WaffoPancakePrivateKey: '',
          WaffoPancakeReturnURL: '',
        }}
        complianceDefaults={{
          confirmed: true,
          termsVersion: 'v1',
          confirmedAt: 1,
          confirmedBy: 1,
        }}
      />
    </SettingsPageProvider>
  )
}

async function openEpayTab(values: Partial<PaymentValues> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <PaymentFixture values={{ ...defaults, ...values }} />
    </QueryClientProvider>
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole('tab', { name: 'Epay' }))
  return user
}

afterEach(() => vi.restoreAllMocks())

describe('Epay signature type', () => {
  it('shows only the MD5 secret by default and only the RSA keys after choosing RSA', async () => {
    const user = await openEpayTab()
    expect(
      screen.getByRole('combobox', { name: 'Signature type' })
    ).toHaveTextContent('MD5')
    expect(screen.getByLabelText('Epay secret key')).toHaveAttribute(
      'type',
      'password'
    )
    expect(
      screen.queryByRole('textbox', { name: 'Merchant private key' })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: 'Signature type' }))
    await user.click(screen.getByRole('option', { name: 'RSA' }))

    expect(screen.queryByLabelText('Epay secret key')).not.toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: 'Merchant private key' })
    ).toBeVisible()
    expect(
      screen.getByRole('textbox', { name: 'Platform public key' })
    ).toBeVisible()
  })

  it('saves both RSA keys before switching the signature type', async () => {
    const request = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true } })
    const user = await openEpayTab()
    await user.click(screen.getByRole('combobox', { name: 'Signature type' }))
    await user.click(screen.getByRole('option', { name: 'RSA' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Merchant private key' }),
      ' merchant-private-key\n'
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Platform public key' }),
      'platform-public-key'
    )

    await user.click(screen.getByRole('button', { name: 'Save all settings' }))

    await waitFor(() => expect(request).toHaveBeenCalledTimes(3))
    expect(request.mock.calls.map((call) => call[1])).toEqual([
      {
        key: 'payment_setting.epay_merchant_private_key',
        value: 'merchant-private-key',
      },
      {
        key: 'payment_setting.epay_platform_public_key',
        value: 'platform-public-key',
      },
      { key: 'payment_setting.epay_sign_type', value: 'RSA' },
    ])
  })

  it('keeps saved RSA keys when switching back to MD5 with blank key fields', async () => {
    const request = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true } })
    const user = await openEpayTab({
      EpaySignType: 'RSA',
      EpayPlatformPublicKey: 'saved-platform-public-key',
    })
    expect(
      screen.getByRole('textbox', { name: 'Merchant private key' })
    ).toHaveValue('')
    expect(
      screen.getByRole('textbox', { name: 'Platform public key' })
    ).toHaveValue('saved-platform-public-key')

    await user.click(screen.getByRole('combobox', { name: 'Signature type' }))
    await user.click(screen.getByRole('option', { name: 'MD5' }))
    await user.click(screen.getByRole('button', { name: 'Save all settings' }))

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/api/option/', {
        key: 'payment_setting.epay_sign_type',
        value: 'MD5',
      })
    )
    expect(request).toHaveBeenCalledTimes(1)
  })
})
