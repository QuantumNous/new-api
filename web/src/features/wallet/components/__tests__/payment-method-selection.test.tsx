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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'

import type { PaymentMethod, TopupInfo, PresetAmount } from '../../types'
import { PaymentConfirmDialog } from '../dialogs/payment-confirm-dialog'
import { PaymentMethodLabel } from '../payment-method-label'
import { RechargeFormCard } from '../recharge-form-card'

const paymentMethods: PaymentMethod[] = [
  {
    name: 'Bank transfer',
    type: 'bank-transfer',
    icon: 'https://example.com/bank-transfer.svg',
  },
  {
    name: 'Card payment',
    type: 'card-payment',
    icon: 'https://example.com/card-payment.svg',
  },
]

const topupInfo: TopupInfo = {
  enable_online_topup: true,
  enable_stripe_topup: false,
  pay_methods: paymentMethods,
  min_topup: 1,
  stripe_min_topup: 1,
  amount_options: [],
  discount: {},
  enable_redemption: false,
}

function PaymentMethodFixture(props: {
  methods?: PaymentMethod[]
  presets?: PresetAmount[]
  calculating?: boolean
  processing?: boolean
  onPay?: (method: PaymentMethod) => void
  payable?: number
  topupOverride?: Partial<TopupInfo>
}) {
  const methods = props.methods || paymentMethods
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(methods[0])

  const [amount, setAmount] = useState(10)
  const [preset, setPreset] = useState<number | null>(null)

  return (
    <RechargeFormCard
      embedded
      pendingOrderNotice={<div>Pending payment fixture</div>}
      topupInfo={{ ...topupInfo, ...props.topupOverride, pay_methods: methods }}
      presetAmounts={props.presets ?? []}
      selectedPreset={preset}
      onSelectPreset={(value) => {
        setPreset(value.value)
        setAmount(value.value)
      }}
      topupAmount={amount}
      onTopupAmountChange={(value) => {
        setPreset(null)
        setAmount(value)
      }}
      paymentAmount={props.payable ?? 10}
      calculating={props.calculating ?? true}
      onPaymentContinue={vi.fn()}
      processing={props.processing}
      onPaymentMethodSelect={(method) => {
        setSelectedPaymentMethod(method)
        props.onPay?.(method)
      }}
      selectedPaymentMethod={selectedPaymentMethod}
      selectedWaffoMethodIndex={null}
      redemptionCode=''
      onRedemptionCodeChange={vi.fn()}
      onRedeem={vi.fn()}
      redeeming={false}
      showRedemption={false}
    />
  )
}

describe('recharge payment method selection', () => {
  test.each([
    ['alipay_direct', 'Alipay', 'SiAlipay', 'text-blue-600', '#1677FF'],
    ['wechatpay_native', 'WeChat Pay', 'SiWechat', 'text-green-700', '#07C160'],
  ])(
    'uses brand colors for %s in selection and confirmation',
    async (type, name, icon, colorClass, color) => {
      const method = { type, name, icon }
      const selection = render(<PaymentMethodFixture methods={[method]} />)
      expect(screen.getByText(name).parentElement).toHaveClass('text-inherit')
      if (type === 'wechatpay_native') {
        expect(
          document.querySelector('img[src="/wechatpay-logo.svg"]')
        ).toBeInTheDocument()
      } else {
        expect((await screen.findByTitle(name)).closest('svg')).toHaveStyle({
          color,
        })
      }
      selection.unmount()
      render(
        <PaymentConfirmDialog
          open
          onOpenChange={vi.fn()}
          onConfirm={vi.fn()}
          topupAmount={10}
          paymentAmount={10}
          paymentMethod={method}
          calculating={false}
          processing={false}
        />
      )
      expect(screen.getByText(name)).toHaveClass(colorClass)
      if (type === 'wechatpay_native') {
        expect(
          document.querySelector('img[src="/wechatpay-logo.svg"]')
        ).toBeInTheDocument()
      } else {
        expect((await screen.findByTitle(name)).closest('svg')).toHaveStyle({
          color,
        })
      }
    }
  )
})

test.each([
  ['wxpay', 'WeChat', 'bg-[#07883f]'],
  ['alipay_direct', 'Alipay', 'bg-[#0969da]'],
  ['mixpay', 'MixPay', 'bg-[#194bff]'],
])(
  'direct %s checkout uses a solid brand button with white content',
  (type, name, background) => {
    render(<PaymentMethodFixture methods={[{ type, name }]} />)
    const label = screen.getByText(
      type === 'mixpay' ? 'MixPay(Crypto)' : name
    ).parentElement
    expect(label?.closest('button')).toHaveClass(
      background,
      'text-white',
      'rounded-xl'
    )
    const icon = label?.querySelector('[aria-hidden="true"]')
    if (type === 'mixpay') {
      expect(icon).not.toHaveClass('brightness-0', 'invert')
      expect(icon?.querySelector('img')).toHaveAttribute(
        'src',
        '/mixpay-logo.svg'
      )
    } else {
      if (type === 'wxpay') {
        expect(icon?.querySelector('img')).toHaveAttribute(
          'src',
          '/wechatpay-logo.svg'
        )
      }
      expect(icon).toHaveClass('brightness-0', 'invert')
    }
  }
)

test.each([
  ['mixpay', 'MixPay', 'text-blue-600'],
  ['epay', 'Epay', 'text-blue-600'],
  ['stripe', 'Stripe', 'text-violet-600'],
  ['creem', 'Creem', 'text-indigo-600'],
  ['waffo_pancake', 'Waffo Pancake', 'text-orange-700'],
  ['waffo', 'Waffo', 'text-blue-600'],
])(
  'shared payment label provides name, icon and theme for %s',
  (method, name, color) => {
    render(<PaymentMethodLabel method={method} />)
    const label = screen.getByText(name).parentElement
    expect(label).toHaveClass(color)
    const icon = label?.querySelector('[aria-hidden="true"]')
    expect(icon).not.toBeEmptyDOMElement()
    if (method === 'waffo_pancake') {
      expect(icon?.firstElementChild).toHaveStyle({
        maskImage: 'url(/waffo-logo-light.svg)',
      })
    } else if (method === 'mixpay') {
      expect(icon?.querySelector('img')).toHaveAttribute(
        'src',
        '/mixpay-logo.svg'
      )
    } else {
      expect(icon?.querySelector('svg')).toBeInTheDocument()
    }
  }
)

test.each([{ presets: [] }, { presets: [{ value: 20, discount: 1 }] }])(
  'amount options and custom input share one group before payment methods (%j)',
  async ({ presets }) => {
    render(<PaymentMethodFixture presets={presets} />)
    const amounts = screen.getByRole('group', { name: 'Amount' })
    const amount = within(amounts).getByLabelText('Custom Amount')
    const methods = screen.getByRole('group', { name: 'Pay with' })
    const notice = screen.getByText('Pending payment fixture')
    expect(
      amounts.compareDocumentPosition(methods) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      methods.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    if (presets.length) {
      await userEvent.click(within(amounts).getByRole('button', { name: /20/ }))
      expect(amount).toHaveValue('')
      expect(amount).toHaveAttribute('placeholder', 'Custom')
    }
    await userEvent.clear(amount)
    await userEvent.type(amount, '35')
    expect(amount).toHaveValue('35')
    if (presets.length) {
      await userEvent.click(within(amounts).getByRole('button', { name: /20/ }))
      expect(amount).toHaveValue('')
      await userEvent.type(amount, '8')
      expect(amount).toHaveValue('8')
    }
  }
)

test('custom amount uses a numeric keyboard without native spinner or wheel adjustment', async () => {
  render(<PaymentMethodFixture />)
  const amount = screen.getByRole('textbox', { name: 'Custom Amount' })
  expect(amount).toHaveAttribute('inputmode', 'numeric')
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  await userEvent.clear(amount)
  await userEvent.type(amount, '25')
  expect(amount).toHaveValue('25')
  await userEvent.type(amount, 'e-abc')
  expect(amount).toHaveValue('25')
  await userEvent.clear(amount)
  expect(amount).toHaveValue('')
})

test('custom amount is a single input with a currency prefix and concise placeholder', () => {
  render(<PaymentMethodFixture />)
  const amount = screen.getByRole('textbox', { name: 'Custom Amount' })
  expect(amount).toHaveAttribute('placeholder', 'Custom')
  expect(screen.queryByText('Custom Amount')).not.toBeInTheDocument()
  const group = amount.closest('[data-slot="input-group"]')
  expect(group).toHaveTextContent('$')
  expect(amount).toHaveClass('border-0')
})

test('each channel is a direct payment action without a selection or separate continue button', async () => {
  const onPay = vi.fn()
  const methods = [
    { type: 'wechatpay_native', name: 'WeChat Pay' },
    { type: 'alipay_direct', name: 'Alipay' },
    { type: 'mixpay', name: 'MixPay' },
  ]
  render(
    <PaymentMethodFixture methods={methods} calculating={false} onPay={onPay} />
  )
  expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  const group = screen.getByRole('group', { name: 'Pay with' })
  expect(group).toHaveClass('grid', 'grid-cols-1', 'gap-3')
  expect(screen.getAllByText('Pay with')).toHaveLength(1)
  expect(within(group).queryByText(/Pay with/)).not.toBeInTheDocument()
  expect(within(group).getAllByRole('button')).toHaveLength(3)
  for (const button of within(group).getAllByRole('button')) {
    expect(button).toHaveClass(
      'h-14',
      'min-h-14',
      'w-full',
      'rounded-xl',
      'border',
      'py-2'
    )
  }
  for (const method of methods) {
    await userEvent.click(
      within(group).getByRole('button', {
        name: method.type === 'mixpay' ? 'MixPay(Crypto)' : method.name,
      })
    )
    expect(onPay).toHaveBeenLastCalledWith(method)
  }
  expect(onPay).toHaveBeenCalledTimes(3)
})

test('starting a payment disables all channel actions', () => {
  render(<PaymentMethodFixture processing />)
  for (const button of within(
    screen.getByRole('group', { name: 'Pay with' })
  ).getAllByRole('button')) {
    expect(button).toBeDisabled()
  }
})

test('minimums apply per channel, including direct MixPay minimum independent of legacy payments', () => {
  render(
    <PaymentMethodFixture
      calculating={false}
      methods={[
        { type: 'mixpay', name: 'MixPay', min_topup: 1 },
        { type: 'bank', name: 'Bank', min_topup: 20 },
      ]}
      topupOverride={{ min_topup: 20 }}
    />
  )
  expect(screen.getByRole('button', { name: 'MixPay(Crypto)' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Bank' })).toBeDisabled()
})

test('preset amounts are centered with discounts on a second line only when applicable', () => {
  render(
    <PaymentMethodFixture
      methods={[{ type: 'alipay_direct', name: 'Alipay' }]}
      presets={[
        { value: 20, discount: 1 },
        { value: 50, discount: 0.95 },
      ]}
    />
  )
  const amounts = screen.getByRole('group', { name: 'Amount' })
  const discounted = within(amounts).getByRole('button', { name: /5% off/ })
  const regular = within(amounts).getByRole('button', { name: /20/ })
  expect(discounted).toHaveClass('items-center', 'text-center')
  const badge = within(discounted).getByText('5% off')
  expect(badge.parentElement).toHaveClass('flex-col', 'items-center')
  expect(badge.previousElementSibling).toHaveTextContent('50')
  expect(regular).toHaveClass('items-center', 'text-center')
  expect(within(regular).queryByText(/off/)).not.toBeInTheDocument()
})

test('discounted preset shows payable price and struck-through original price above its discount', () => {
  render(
    <PaymentMethodFixture
      presets={[
        { value: 20, discount: 1 },
        { value: 50, discount: 0.95 },
      ]}
    />
  )
  const amounts = screen.getByRole('group', { name: 'Amount' })
  const discounted = within(amounts).getByRole('button', { name: /5% off/ })
  expect(within(discounted).getByText(/50/)).toHaveClass('line-through')
  expect(discounted).not.toHaveTextContent('Pay ')
  const badge = within(discounted).getByText('5% off')
  expect(badge.previousElementSibling).toHaveTextContent('47.5')
  const regular = within(amounts).getByRole('button', { name: /20/ })
  expect(regular.textContent?.match(/20/g)).toHaveLength(1)
  expect(regular.querySelector('.line-through')).not.toBeInTheDocument()
})

test('custom amount centers the currency prefix and content together', async () => {
  render(<PaymentMethodFixture />)
  const input = screen.getByLabelText('Custom Amount')
  const group = input.closest('[data-slot="input-group"]')
  expect(group).toHaveClass('justify-center')
  expect(input).toHaveClass('field-sizing-content', 'flex-none', 'text-center')
  await userEvent.clear(input)
  expect(input).toHaveAttribute('placeholder', 'Custom')
  await userEvent.type(input, '12345')
  expect(input).toHaveValue('12345')
})

test('MixPay-only configuration displays recharge controls and its direct payment action', () => {
  render(
    <PaymentMethodFixture
      methods={[{ type: 'mixpay', name: 'MixPay', min_topup: 1 }]}
      calculating={false}
      payable={10}
      topupOverride={{ enable_online_topup: false, enable_mixpay_topup: true }}
    />
  )
  expect(screen.getByRole('group', { name: 'Amount' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'MixPay(Crypto)' })).toBeEnabled()
})

test('WebMoney-only configuration enables recharge without Epay or MixPay', () => {
  render(
    <PaymentMethodFixture
      methods={[{ type: 'webmoney', name: 'WebMoney', min_topup: 1 }]}
      calculating={false}
      payable={10}
      topupOverride={{ enable_online_topup: false, enable_mixpay_topup: false }}
    />
  )
  expect(screen.getByRole('group', { name: 'Amount' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'WebMoney' })).toBeEnabled()
})

test('Antom-only configuration offers a direct top-up action', () => {
  render(
    <PaymentMethodFixture
      methods={[{ type: 'antom', name: 'Antom', min_topup: 1 }]}
    />
  )
  expect(screen.getByRole('button', { name: 'Antom' })).toBeEnabled()
})

test('Antom displays payment brands without adding extra payment actions', async () => {
  const onPay = vi.fn()
  const method = { type: 'antom', name: 'Antom' }
  render(
    <PaymentMethodFixture
      methods={[method]}
      calculating={false}
      onPay={onPay}
    />
  )
  const group = screen.getByRole('group', { name: 'Pay with' })
  const button = within(group).getByRole('button', { name: 'Antom' })
  expect(within(group).getAllByRole('button')).toHaveLength(1)
  expect(button.querySelector('[title="Visa"] img')).toHaveAttribute(
    'src',
    '/payment-methods/antom/visa.svg'
  )
  expect(button.querySelector('[title="Apple Pay"]')).not.toBeNull()
  expect(
    within(button).getByRole('img', { name: 'Antom' }).parentElement
  ).toHaveClass('absolute', 'left-1/2', 'z-10', 'w-[40%]', 'bg-white')
  expect(button.querySelector('.antom-payment-icons')).toHaveClass(
    'w-full',
    'max-w-full',
    'shrink-0',
    'overflow-hidden'
  )
  await userEvent.click(button)
  expect(onPay).toHaveBeenCalledWith(method)
})

test('MixPay keeps its centered label above a full-width crypto icon strip', async () => {
  const onPay = vi.fn()
  const method = { type: 'mixpay', name: 'MixPay' }
  render(
    <PaymentMethodFixture
      methods={[method]}
      calculating={false}
      onPay={onPay}
    />
  )
  const button = screen.getByRole('button', { name: 'MixPay(Crypto)' })
  expect(button).toHaveClass('relative', 'overflow-hidden')
  expect(button.querySelector('[title="Bitcoin"] img')).toHaveAttribute(
    'src',
    '/payment-methods/mixpay/btc.png'
  )
  expect(button.querySelector('.antom-payment-icons')).toHaveClass('w-full')
  expect(
    within(button).getByText('MixPay(Crypto)').parentElement?.parentElement
  ).toHaveClass('w-[40%]', 'bg-[#194bff]', 'z-10')
  await userEvent.click(button)
  expect(onPay).toHaveBeenCalledWith(method)
})
