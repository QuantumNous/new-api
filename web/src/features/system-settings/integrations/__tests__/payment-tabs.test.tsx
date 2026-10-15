import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { PaymentSettingsSection } from '../payment-settings-section'

test('payment tabs wrap without shrinking labels and retain selection', async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PaymentSettingsSection
        defaultValues={{
          PayAddress: '',
          EpayId: '',
          EpayKey: '',
          Price: 1,
          MinTopUp: 1,
          CustomCallbackAddress: '',
          PayMethods: '[]',
          AmountOptions: '[]',
          AmountDiscount: '{}',
          StripeApiSecret: '',
          StripeWebhookSecret: '',
          StripePriceId: '',
          StripeUnitPrice: 1,
          StripeMinTopUp: 1,
          StripePromotionCodesEnabled: false,
          CreemApiKey: '',
          CreemWebhookSecret: '',
          CreemTestMode: false,
          CreemProducts: '[]',
        }}
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
    </QueryClientProvider>
  )
  const list = screen.getByRole('tablist')
  expect(list).toHaveClass(
    'flex-wrap',
    'w-full',
    'group-data-horizontal/tabs:h-auto'
  )
  expect(list.parentElement).not.toHaveClass('overflow-x-auto')
  for (const tab of screen.getAllByRole('tab')) {
    expect(tab).toHaveClass('flex-none', 'h-8')
  }
  expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await userEvent.click(screen.getByRole('tab', { name: 'Stripe' }))
  expect(screen.getByRole('tab', { name: 'Stripe' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  expect(screen.getByRole('tab', { name: 'MixPay' })).toBeVisible()
  expect(screen.getByRole('tab', { name: 'WebMoney' })).toBeVisible()
})
