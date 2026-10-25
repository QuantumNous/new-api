import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import i18next from 'i18next'
import { useState } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'
import { createTestAuthBundle } from '@/test-utils/auth-bundle'

import { CreemConfirmDialog } from '../dialogs/creem-confirm-dialog'
import { PayerCashbackPreview } from '../payer-cashback-preview'
import { RechargeFormCard } from '../recharge-form-card'

const originalAdapter = api.defaults.adapter
const originalConfig = useSystemConfigStore.getState().config
let client: QueryClient

beforeEach(() => {
  useAuthStore.getState().auth.setBundle(createTestAuthBundle())
  useSystemConfigStore.setState({
    config: {
      ...originalConfig,
      currency: {
        ...originalConfig.currency,
        quotaPerUnit: 100,
        quotaDisplayType: 'USD',
        usdExchangeRate: 1,
      },
    },
  })
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

afterEach(async () => {
  cleanup()
  client.clear()
  api.defaults.adapter = originalAdapter
  useAuthStore.getState().auth.reset()
  useSystemConfigStore.setState({ config: originalConfig })
  await i18next.changeLanguage('en')
})

function show(selection: { amount?: number; productId?: string }) {
  return render(
    <QueryClientProvider client={client}>
      <PayerCashbackPreview {...selection} />
    </QueryClientProvider>
  )
}

test('tiered preview shows reached cent tier in CNY even when quota display is USD', async () => {
  api.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: {
      success: true,
      data: {
        status: 'estimated',
        strategy: 'tiered',
        config_version: 5,
        tiers: [{ threshold_cents: 10050, reward_cents: 250 }],
        matched_tier: { threshold_cents: 10050, reward_cents: 250 },
        reward_quota: 250,
        as_of: 1,
      },
    },
  })
  show({ amount: 101 })
  expect(await screen.findByText(/¥100\.50.*¥2\.50/)).toBeVisible()
  expect(screen.getByText('Highest tier reached: ¥100.50')).toBeVisible()
})

test('reached tier that floors to zero quota is not described as below the threshold', async () => {
  api.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: {
      success: true,
      data: {
        status: 'rounds_to_zero',
        strategy: 'tiered',
        tiers: [{ threshold_cents: 10050, reward_cents: 1 }],
        matched_tier: { threshold_cents: 10050, reward_cents: 1 },
        reward_quota: 0,
        as_of: 1,
      },
    },
  })
  show({ amount: 101 })
  expect(await screen.findByText('Highest tier reached: ¥100.50')).toBeVisible()
  expect(
    screen.getByText('This tier reward rounds down to zero wallet quota.')
  ).toBeVisible()
  expect(
    screen.queryByText('This amount is below the cashback threshold.')
  ).not.toBeInTheDocument()
  expect(screen.queryByText(/Estimated cashback:/)).not.toBeInTheDocument()
})

test('non-applicable tiered product does not promise a payout', async () => {
  api.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: {
      success: true,
      data: {
        status: 'not_applicable',
        strategy: 'tiered',
        reward_quota: 0,
        as_of: 1,
      },
    },
  })
  show({ productId: 'product-1' })
  expect(
    await screen.findByText(
      'Tiered cashback is not available for this top-up method.'
    )
  ).toBeVisible()
  expect(screen.queryByText(/Estimated cashback:/)).not.toBeInTheDocument()
})

test('amount switch ignores late estimate from the prior amount', async () => {
  let resolveOld!: (value: unknown) => void
  const oldResponse = new Promise<unknown>((resolve) => {
    resolveOld = resolve
  })
  api.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data:
      config.params.amount === 100
        ? await oldResponse
        : {
            success: true,
            data: {
              status: 'estimated',
              strategy: 'rate',
              rate_bps: 500,
              reward_quota: 200,
              as_of: 1,
            },
          },
  })
  const view = show({ amount: 100 })
  view.rerender(
    <QueryClientProvider client={client}>
      <PayerCashbackPreview amount={200} />
    </QueryClientProvider>
  )
  expect(screen.getByText('Checking your cashback estimate…')).toBeVisible()
  expect(screen.queryByText(/Estimated cashback:/)).not.toBeInTheDocument()
  expect(await screen.findByText('Estimated cashback: $2.00')).toBeVisible()
  expect(
    screen.getByText('Campaign rule: 5% of the selected face amount')
  ).toBeVisible()
  await act(async () => {
    resolveOld({
      success: true,
      data: {
        status: 'estimated',
        strategy: 'rate',
        rate_bps: 900,
        reward_quota: 9000,
        as_of: 1,
      },
    })
    await oldResponse
  })
  expect(screen.getByText('Estimated cashback: $2.00')).toBeVisible()
  expect(
    screen.queryByText('Estimated cashback: $90.00')
  ).not.toBeInTheDocument()
  expect(screen.getByText(/Estimate only/)).toBeVisible()
})

test('Creem product uses its own selection and displays fixed rule without a standard amount estimate', async () => {
  api.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: {
      success: true,
      data: {
        status: 'estimated',
        strategy: 'per_hundred',
        fixed_per_hundred: 20,
        reward_quota: config.params.product_id === 'first' ? 40 : 60,
        as_of: 1,
      },
    },
  })
  const view = show({ productId: 'first' })
  expect(await screen.findByText('Estimated cashback: $0.40')).toBeVisible()
  expect(
    screen.getByText('Campaign rule: 20 for every 100 face units')
  ).toBeVisible()
  view.rerender(
    <QueryClientProvider client={client}>
      <PayerCashbackPreview productId='second' />
    </QueryClientProvider>
  )
  expect(await screen.findByText('Estimated cashback: $0.60')).toBeVisible()
  expect(
    screen.queryByText('Estimated cashback: $0.40')
  ).not.toBeInTheDocument()
})

test('Creem confirmation requests the selected product instead of the standard amount', async () => {
  const selections: unknown[] = []
  api.defaults.adapter = async (config) => {
    selections.push(config.params)
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: {
        success: true,
        data: {
          status: 'estimated',
          strategy: 'rate',
          rate_bps: 500,
          reward_quota: 40,
          as_of: 1,
        },
      },
    }
  }
  render(
    <QueryClientProvider client={client}>
      <CreemConfirmDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        product={{
          name: 'Bundle',
          productId: 'selected-bundle',
          price: 1,
          quota: 250,
          currency: 'USD',
        }}
        processing={false}
      />
    </QueryClientProvider>
  )
  expect(await screen.findByText('Estimated cashback: $0.40')).toBeVisible()
  expect(selections).toEqual([{ product_id: 'selected-bundle' }])
  expect(screen.getByRole('button', { name: 'Confirm Payment' })).toBeEnabled()
})

test('small Creem reward keeps raw quota precision instead of rounding up to a larger amount', async () => {
  useSystemConfigStore.setState({
    config: {
      ...originalConfig,
      currency: {
        ...originalConfig.currency,
        quotaPerUnit: 500_000,
        quotaDisplayType: 'USD',
        usdExchangeRate: 1,
      },
    },
  })
  api.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: {
      success: true,
      data: {
        status: 'estimated',
        strategy: 'per_hundred',
        fixed_per_hundred: 20,
        reward_quota: 40,
        as_of: 1,
      },
    },
  })
  show({ productId: 'small-product' })
  expect(await screen.findByText('Estimated cashback: $0.00008')).toBeVisible()
})

test('zero amount, inactive campaign and failed request never display a positive reward', async () => {
  api.defaults.adapter = async (config) => {
    let data: unknown = { success: false, message: 'unavailable' }
    if (config.params.amount === 0) {
      data = {
        success: true,
        data: { status: 'select_amount', reward_quota: 0, as_of: 1 },
      }
    } else if (config.params.amount === 100) {
      data = {
        success: true,
        data: {
          status: 'no_campaign',
          strategy: 'rate',
          rate_bps: 500,
          reward_quota: 0,
          as_of: 1,
        },
      }
    }
    return { config, status: 200, statusText: 'OK', headers: {}, data }
  }
  const view = show({ amount: 0 })
  expect(
    await screen.findByText('Select an amount to preview cashback.')
  ).toBeVisible()
  view.rerender(
    <QueryClientProvider client={client}>
      <PayerCashbackPreview amount={100} />
    </QueryClientProvider>
  )
  expect(
    await screen.findByText('No active cashback campaign for this top-up.')
  ).toBeVisible()
  expect(screen.queryByText(/Campaign rule:/)).not.toBeInTheDocument()
  view.rerender(
    <QueryClientProvider client={client}>
      <PayerCashbackPreview amount={200} />
    </QueryClientProvider>
  )
  expect(
    await screen.findByText('Cashback estimate is temporarily unavailable.')
  ).toBeVisible()
  expect(screen.queryByText(/Estimated cashback:/)).not.toBeInTheDocument()
})

test('an amount rejected by checkout bounds is invalid rather than a service failure', async () => {
  api.defaults.adapter = async (config) => {
    throw new AxiosError(
      'Invalid preview selection',
      'ERR_BAD_REQUEST',
      config,
      null,
      {
        config,
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        data: { success: false },
      }
    )
  }
  show({ amount: 10 })
  expect(
    await screen.findByText('Select a valid amount to preview cashback.')
  ).toBeVisible()
  expect(
    screen.queryByText('Cashback estimate is temporarily unavailable.')
  ).not.toBeInTheDocument()
})

test('lower Stripe minimum allows preview and payment while Epay stays disabled', async () => {
  api.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: {
      success: true,
      data: {
        status: 'estimated',
        strategy: 'rate',
        rate_bps: 500,
        reward_quota: 5,
        as_of: 1,
      },
    },
  })
  const onPay = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <RechargeFormCard
        topupInfo={{
          enable_online_topup: true,
          enable_stripe_topup: true,
          pay_methods: [
            { type: 'alipay', name: 'Alipay' },
            { type: 'stripe', name: 'Stripe', min_topup: 1 },
          ],
          min_topup: 10,
          stripe_min_topup: 1,
          amount_options: [],
          discount: {},
        }}
        presetAmounts={[]}
        selectedPreset={null}
        onSelectPreset={vi.fn()}
        topupAmount={5}
        onTopupAmountChange={vi.fn()}
        paymentAmount={5}
        calculating={false}
        onPaymentMethodSelect={onPay}
        paymentLoading={null}
        redemptionCode=''
        onRedemptionCodeChange={vi.fn()}
        onRedeem={vi.fn()}
        redeeming={false}
      />
    </QueryClientProvider>
  )
  expect(await screen.findByText('Estimated cashback: $0.05')).toBeVisible()
  expect(screen.getByLabelText('Custom Amount')).toHaveAttribute('min', '1')
  expect(screen.getByRole('button', { name: /Alipay/ })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Stripe' }))
  expect(onPay).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'stripe' })
  )
})

test('recharge form refreshes the estimate when custom amount changes without changing payment actions', async () => {
  api.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: {
      success: true,
      data:
        Number(config.params.amount) === 0
          ? { status: 'select_amount', reward_quota: 0, as_of: 1 }
          : {
              status: 'estimated',
              strategy: 'rate',
              rate_bps: 500,
              reward_quota: Number(config.params.amount) * 2,
              as_of: 1,
            },
    },
  })
  const onPay = vi.fn()
  function Form() {
    const [amount, setAmount] = useState(100)
    return (
      <RechargeFormCard
        topupInfo={{
          enable_online_topup: true,
          enable_stripe_topup: false,
          pay_methods: [{ type: 'alipay', name: 'Alipay' }],
          min_topup: 1,
          stripe_min_topup: 1,
          amount_options: [100, 250],
          discount: {},
        }}
        presetAmounts={[{ value: 100 }, { value: 250 }]}
        selectedPreset={null}
        onSelectPreset={(preset) => setAmount(preset.value)}
        topupAmount={amount}
        onTopupAmountChange={setAmount}
        paymentAmount={100}
        calculating={false}
        onPaymentMethodSelect={onPay}
        paymentLoading={null}
        redemptionCode=''
        onRedemptionCodeChange={vi.fn()}
        onRedeem={vi.fn()}
        redeeming={false}
      />
    )
  }
  render(
    <QueryClientProvider client={client}>
      <Form />
    </QueryClientProvider>
  )
  expect(await screen.findByText('Estimated cashback: $2.00')).toBeVisible()
  await userEvent.clear(screen.getByLabelText('Custom Amount'))
  expect(
    await screen.findByText('Select an amount to preview cashback.')
  ).toBeVisible()
  await userEvent.type(screen.getByLabelText('Custom Amount'), '250')
  expect(await screen.findByText('Estimated cashback: $5.00')).toBeVisible()
  expect(
    screen.queryByText('Estimated cashback: $2.00')
  ).not.toBeInTheDocument()
  await userEvent.clear(screen.getByLabelText('Custom Amount'))
  await userEvent.type(screen.getByLabelText('Custom Amount'), '1.5')
  expect(
    await screen.findByText('Select an amount to preview cashback.')
  ).toBeVisible()
  expect(screen.queryByText(/Estimated cashback:/)).not.toBeInTheDocument()
  expect(onPay).not.toHaveBeenCalled()
})

function renderCnyRechargeForm(topupAmount: number) {
  useSystemConfigStore.setState({
    config: {
      ...originalConfig,
      currency: {
        ...originalConfig.currency,
        quotaPerUnit: 100,
        quotaDisplayType: 'CNY',
        usdExchangeRate: 1,
      },
    },
  })
  return render(
    <QueryClientProvider client={client}>
      <RechargeFormCard
        topupInfo={{
          enable_online_topup: true,
          enable_stripe_topup: false,
          pay_methods: [{ type: 'alipay', name: 'Alipay' }],
          min_topup: 1,
          stripe_min_topup: 1,
          amount_options: [10, 50, 100, 250],
          discount: {},
        }}
        presetAmounts={[
          { value: 10 },
          { value: 50 },
          { value: 100 },
          { value: 250 },
        ]}
        selectedPreset={topupAmount}
        onSelectPreset={vi.fn()}
        topupAmount={topupAmount}
        onTopupAmountChange={vi.fn()}
        paymentAmount={topupAmount}
        calculating={false}
        onPaymentMethodSelect={vi.fn()}
        paymentLoading={null}
        redemptionCode=''
        onRedemptionCodeChange={vi.fn()}
        onRedeem={vi.fn()}
        redeeming={false}
      />
    </QueryClientProvider>
  )
}

test('per-hundred rule is shown in the display currency and preset cards carry their nominal cashback', async () => {
  api.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: {
      success: true,
      data: {
        status: 'estimated',
        strategy: 'per_hundred',
        fixed_per_hundred: 3,
        // floor(250 / 100) * 3 face units * 100 quota per unit
        reward_quota: 600,
        as_of: 1,
      },
    },
  })
  renderCnyRechargeForm(250)
  expect(await screen.findByText('Estimated cashback: ¥6.00')).toBeVisible()
  expect(
    screen.getByText('Campaign rule: ¥3 back for every ¥100 topped up')
  ).toBeVisible()
  expect(screen.getByText('Pay ¥10')).toBeVisible()
  expect(screen.getByText('Pay ¥250')).toBeVisible()
  expect(await screen.findByText('Cashback ¥3')).toBeVisible()
  expect(screen.getByText('Cashback ¥6')).toBeVisible()
  // 10 and 50 never reach a complete hundred.
  expect(screen.getAllByText(/^Cashback /)).toHaveLength(2)
})

test('preset cashback hints stay hidden when the payer cannot receive cashback', async () => {
  api.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: {
      success: true,
      data: {
        status: 'limit_reached',
        strategy: 'per_hundred',
        fixed_per_hundred: 3,
        reward_quota: 0,
        as_of: 1,
      },
    },
  })
  renderCnyRechargeForm(250)
  expect(
    await screen.findByText('Your cashback campaign limit has been reached.')
  ).toBeVisible()
  expect(screen.queryByText(/^Cashback /)).not.toBeInTheDocument()
})

test('a payer who topped up before is told the campaign is for first top-ups only', async () => {
  api.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: {
      success: true,
      data: {
        status: 'not_first_top_up',
        strategy: 'tiered',
        tiers: [{ threshold_cents: 10000, reward_cents: 500 }],
        reward_quota: 0,
        as_of: 1,
      },
    },
  })
  renderCnyRechargeForm(250)
  expect(
    await screen.findByText(
      'This campaign rewards first top-ups only, and your account has topped up before.'
    )
  ).toBeVisible()
  expect(screen.queryByText(/^Cashback /)).not.toBeInTheDocument()
})

test('a capped estimate explains the rule amount and the limit that reduced it', async () => {
  api.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: {
      success: true,
      data: {
        status: 'estimated',
        strategy: 'per_hundred',
        fixed_per_hundred: 3,
        calculated_quota: 600,
        reward_quota: 100,
        cap_reason: 'single_cap',
        as_of: 1,
      },
    },
  })
  renderCnyRechargeForm(250)
  expect(await screen.findByText('Estimated cashback: ¥1.00')).toBeVisible()
  expect(
    screen.getByText(
      'The rule gives ¥6.00, reduced by the single cashback limit.'
    )
  ).toBeVisible()
})
