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
  payable?: number
}) {
  const methods = props.methods || paymentMethods
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(methods[0])

  const [amount, setAmount] = useState(10)
  const [preset, setPreset] = useState<number | null>(null)

  return (
    <RechargeFormCard
      embedded
      pendingOrderNotice={<div>Pending payment fixture</div>}
      topupInfo={{ ...topupInfo, pay_methods: methods }}
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
      onPaymentMethodSelect={setSelectedPaymentMethod}
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
      expect(screen.getByText(name)).toHaveClass(colorClass)
      expect((await screen.findByTitle(name)).closest('svg')).toHaveStyle({
        color,
      })
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
      expect((await screen.findByTitle(name)).closest('svg')).toHaveStyle({
        color,
      })
    }
  )
  test('keeps payment icons visible and allows selection while its amount recalculates', async () => {
    const user = userEvent.setup()

    render(<PaymentMethodFixture />)

    const bankTransfer = screen.getByRole('radio', { name: 'Bank transfer' })
    const cardPayment = screen.getByRole('radio', { name: 'Card payment' })

    expect(screen.getByRole('img', { name: 'Bank transfer' })).toBeVisible()
    expect(screen.getByRole('img', { name: 'Card payment' })).toBeVisible()
    expect(cardPayment).toBeEnabled()

    await user.click(cardPayment)

    expect(bankTransfer).toHaveAttribute('aria-checked', 'false')
    expect(cardPayment).toHaveAttribute('aria-checked', 'true')
    expect(cardPayment).toHaveClass('border-primary', 'ring-1')
    expect(screen.getByRole('img', { name: 'Bank transfer' })).toBeVisible()
    expect(screen.getByRole('img', { name: 'Card payment' })).toBeVisible()
  })
})

test.each([
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
    const methods = screen.getByRole('radiogroup', { name: 'Payment Method' })
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

test('payment button combines the selected method and actual quote without a separate amount row', async () => {
  render(
    <PaymentMethodFixture
      calculating={false}
      payable={18}
      methods={[
        { type: 'alipay_direct', name: 'Alipay' },
        { type: 'wechatpay_native', name: 'WeChat Pay' },
      ]}
    />
  )
  expect(screen.queryByText('Amount to pay:')).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Pay ¥18 with Alipay' })
  ).toBeEnabled()
  expect(
    screen
      .getByRole('button', { name: 'Pay ¥18 with Alipay' })
      .querySelector('[aria-hidden="true"] svg')
  ).toBeInTheDocument()
  await userEvent.click(screen.getByRole('radio', { name: 'WeChat Pay' }))
  expect(
    screen.getByRole('button', { name: 'Pay ¥18 with WeChat Pay' })
  ).toBeEnabled()
})
test('payment button shows calculation status instead of a stale quote', () => {
  render(<PaymentMethodFixture calculating payable={18} />)
  expect(screen.getByRole('button', { name: 'Calculating...' })).toBeDisabled()
  expect(screen.queryByText('Amount to pay:')).not.toBeInTheDocument()
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

test('selecting a discounted amount shows savings as a tilted payment-button corner badge', async () => {
  render(
    <PaymentMethodFixture
      calculating={false}
      presets={[
        { value: 200, discount: 0.85 },
        { value: 20, discount: 1 },
      ]}
    />
  )
  const amounts = screen.getByRole('group', { name: 'Amount' })
  expect(screen.queryByText(/Save \d+%/)).not.toBeInTheDocument()
  await userEvent.click(
    within(amounts).getByRole('button', { name: /15% off/ })
  )
  const savings = screen.getByText('Save 15%')
  expect(savings).toHaveAttribute('data-slot', 'badge')
  expect(savings).toHaveClass('absolute', 'right-3', 'top-0', '-rotate-6')
  expect(savings.parentElement).toHaveClass('relative')
  const paymentArea = savings.parentElement
  if (!paymentArea) throw new Error('Missing payment button container')
  expect(within(paymentArea).getByRole('button', { name: /Pay/ })).toBeEnabled()
  await userEvent.click(within(amounts).getByRole('button', { name: /20$/ }))
  expect(screen.queryByText(/Save \d+%/)).not.toBeInTheDocument()
})
