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
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { SubscriptionPurchaseDialog } from '@/features/subscriptions/components/dialogs/subscription-purchase-dialog'
import type {
  PlanRecord,
  UserSubscriptionRecord,
} from '@/features/subscriptions/types'
import { api } from '@/lib/api'

import { Wallet } from '..'
import { SubscriptionPlansCard } from '../components/subscription-plans-card'

const i18n = createInstance()
let plans: PlanRecord[]
let subscriptions: UserSubscriptionRecord[]
let client: QueryClient

beforeEach(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
  plans = Array.from({ length: 7 }, (_, i) => ({
    plan: {
      id: i + 1,
      title: `Plan ${i + 1}`,
      price_amount: i + 1,
      currency: 'USD',
      duration_unit: 'month',
      duration_value: 1,
      quota_reset_period: 'never',
      enabled: true,
      sort_order: 0,
      max_purchase_per_user: 0,
      total_amount: 0,
      daily_limit: 500000,
      weekly_limit: 1000000,
      monthly_limit: 1500000,
      allow_balance_pay: true,
      allow_wallet_overflow: true,
    },
  }))
  const window = { limit: 500000, used: 100000, reset_at: 1900000000 }
  subscriptions = Array.from({ length: 7 }, (_, i) => ({
    subscription: {
      id: i + 1,
      user_id: 1,
      plan_id: i + 1,
      status: 'active',
      start_time: 1700000000,
      end_time: 1900000000,
      amount_total: 0,
      amount_used: 0,
      quota_windows: { daily: window, weekly: window, monthly: window },
    },
  }))
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['status'], { price: 1 })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/subscription/plans') {
      return { data: { success: true, data: plans } }
    }
    if (url === '/api/subscription/self') {
      return {
        data: {
          success: true,
          data: {
            subscriptions,
            all_subscriptions: subscriptions,
            billing_preference: 'subscription_first',
          },
        },
      }
    }
    if (url === '/api/user/self') {
      return {
        data: {
          success: true,
          data: { id: 1, quota: 50000000, used_quota: 0 },
        },
      }
    }
    if (url === '/api/user/topup/info') {
      return {
        data: {
          success: true,
          data: {
            enable_online_topup: false,
            payment_compliance_confirmed: true,
            pay_methods: [],
          },
        },
      }
    }
    if (url === '/api/user/aff') {
      return { data: { success: true, data: 'preview' } }
    }
    if (url === '/api/status') {
      return { data: { success: true, data: { price: 1 } } }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
})
afterEach(() => client.clear())

function renderWallet(element: React.ReactNode) {
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>{element}</QueryClientProvider>
    </I18nextProvider>
  )
}

it('shows recharge and purchased subscriptions together with the plan catalog below', async () => {
  const user = userEvent.setup()
  renderWallet(<Wallet />)
  const code = await screen.findByPlaceholderText('Enter your redemption code')
  const subscriptionsRegion = await screen.findByRole('region', {
    name: 'My Subscriptions',
  })
  const overview = code.closest('[data-slot="wallet-overview"]')
  expect(overview).toContainElement(subscriptionsRegion)
  expect(overview).toHaveClass('xl:grid-cols-2')
  expect(overview).not.toContainElement(
    screen.getByRole('region', { name: 'Subscription Plans' })
  )
  expect(
    screen.queryByRole('tablist', { name: 'Wallet' })
  ).not.toBeInTheDocument()
  await user.type(code, 'KEEP-ME')
  await user.click(
    screen.getByRole('button', { name: /Plan 1 · Subscription #1/ })
  )
  expect(code).toHaveValue('KEEP-ME')
  expect(code).toBeVisible()
})

it('paginates plan cards and opens the selected plan from a later page', async () => {
  const user = userEvent.setup()
  renderWallet(<SubscriptionPlansCard topupInfo={null} />)
  await screen.findByRole('heading', { name: 'Plan 1' })
  expect(screen.getAllByRole('button', { name: 'Subscribe Now' })).toHaveLength(
    3
  )
  expect(
    screen.queryByRole('heading', { name: 'Plan 4' })
  ).not.toBeInTheDocument()
  const navigation = screen.getByRole('navigation', {
    name: 'Subscription Plans',
  })
  await user.click(
    within(navigation).getByRole('button', { name: 'Go to next page' })
  )
  expect(screen.getByRole('heading', { name: 'Plan 4' })).toBeVisible()
  await user.click(screen.getAllByRole('button', { name: 'Subscribe Now' })[0])
  expect(await screen.findByRole('dialog')).toHaveTextContent('Plan 4')
})

it('shows one purchased subscription detail at a time and pages through history', async () => {
  const user = userEvent.setup()
  renderWallet(<SubscriptionPlansCard topupInfo={null} />)
  const first = await screen.findByRole('button', {
    name: /Plan 1 · Subscription #1/,
  })
  expect(first).toHaveAttribute('aria-expanded', 'false')
  await user.click(first)
  expect(first).toHaveAttribute('aria-expanded', 'true')
  await user.click(
    screen.getByRole('button', { name: /Plan 2 · Subscription #2/ })
  )
  expect(first).toHaveAttribute('aria-expanded', 'false')
  expect(
    screen.getAllByRole('group', { name: 'Daily quota limit' })
  ).toHaveLength(1)
  const navigation = screen.getByRole('navigation', {
    name: 'My Subscriptions',
  })
  await user.click(
    within(navigation).getByRole('button', { name: 'Go to next page' })
  )
  expect(
    screen.queryByRole('button', { name: /Plan 1 · Subscription #1/ })
  ).not.toBeInTheDocument()
  const sixth = screen.getByRole('button', { name: /Plan 6 · Subscription #6/ })
  await user.click(sixth)
  expect(sixth).toHaveAttribute('aria-expanded', 'true')
})

it('shows recharge at full width when there are no subscriptions or plans', async () => {
  plans = []
  subscriptions = []
  renderWallet(<Wallet />)
  const code = await screen.findByPlaceholderText('Enter your redemption code')
  await waitFor(() =>
    expect(
      screen.queryByRole('region', { name: 'My Subscriptions' })
    ).not.toBeInTheDocument()
  )
  expect(code).toBeVisible()
  expect(code.closest('[data-slot="wallet-overview"]')).not.toHaveClass(
    'xl:grid-cols-2'
  )
  expect(
    screen.queryByRole('tablist', { name: 'Wallet' })
  ).not.toBeInTheDocument()
})

it.each([
  ['My Subscriptions', /Plan 1 · Subscription #1/, 300],
  ['Subscription Plans', 'Plan 1', 900],
] as const)(
  'keeps %s compact when paging to fewer rows',
  async (label, firstItem, height) => {
    plans = plans.slice(0, 4)
    const user = userEvent.setup()
    renderWallet(<SubscriptionPlansCard topupInfo={null} />)
    const marker =
      typeof firstItem === 'string'
        ? await screen.findByRole('heading', { name: firstItem })
        : await screen.findByRole('button', { name: firstItem })
    const originalRect = HTMLElement.prototype.getBoundingClientRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this.contains(marker)) {
          return {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: 500,
            bottom: height,
            width: 500,
            height,
            toJSON: () => ({}),
          }
        }
        return originalRect.call(this)
      }
    )
    const navigation = screen.getByRole('navigation', { name: label })
    await user.click(
      within(navigation).getByRole('button', { name: 'Go to next page' })
    )
    const region = screen.getByRole('region', { name: label })
    expect(
      region.querySelector<HTMLElement>(
        '[data-slot="pagination-frame-content"]'
      )?.style.minHeight
    ).toBe('')
    if (label === 'Subscription Plans') {
      expect(within(region).getAllByRole('heading')).toHaveLength(1)
    }
  }
)

it('truncates long subscription names when collapsed and expanded while keeping metadata visible', async () => {
  const user = userEvent.setup()
  const longTitle = 'DeepSeek 包月套餐（名称很长的示例）'.repeat(3)
  plans[0].plan.title = longTitle
  plans[1].plan.title = 'Short'
  renderWallet(<SubscriptionPlansCard topupInfo={null} />)
  const longRow = await screen.findByRole('button', {
    name: new RegExp(`Subscription #1`),
  })
  const shortRow = screen.getByRole('button', {
    name: /Short · Subscription #2/,
  })
  const longName = within(longRow).getByText(longTitle, { exact: true })
  const shortName = within(shortRow).getByText('Short', { exact: true })
  for (const name of [longName, shortName]) {
    expect(name).toHaveClass('truncate', 'text-sm', 'leading-5')
  }
  expect(within(longRow).getByText('#1', { exact: true })).toBeVisible()
  expect(within(shortRow).getByText('#2', { exact: true })).toBeVisible()
  expect(longRow).toHaveAccessibleName(expect.stringContaining(longTitle))
  expect(longRow).toHaveClass('min-w-0')
  expect(within(longRow).getByText('Active', { exact: true })).toBeVisible()
  expect(within(longRow).getByText(/days remaining/)).toBeVisible()
  await user.click(longRow)
  expect(longRow).toHaveAttribute('aria-expanded', 'true')
  expect(longName).toHaveClass('truncate')
  expect(longName).not.toHaveClass(
    'group-aria-expanded/accordion-trigger:whitespace-normal'
  )
  await user.click(longRow)
  expect(longRow).toHaveAttribute('aria-expanded', 'false')
  expect(longName).toHaveClass('truncate')
})

it.each(['mouse', 'keyboard'] as const)(
  'resets subscription and quota details when revisiting a page before %s toggles',
  async (interaction) => {
    const user = userEvent.setup()
    renderWallet(<SubscriptionPlansCard topupInfo={null} />)
    const first = await screen.findByRole('button', {
      name: /Plan 1 · Subscription #1/,
    })
    await user.click(first)
    const daily = within(
      screen.getByRole('group', { name: 'Daily quota limit' })
    ).getByRole('button')
    await user.click(daily)
    expect(daily).toHaveAttribute('aria-expanded', 'true')
    const originalRect = HTMLElement.prototype.getBoundingClientRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this.dataset.slot === 'pagination-frame-content') {
          return {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: 500,
            bottom: 520,
            width: 500,
            height: 520,
            toJSON: () => ({}),
          }
        }
        return originalRect.call(this)
      }
    )
    const navigation = screen.getByRole('navigation', {
      name: 'My Subscriptions',
    })
    await user.click(
      within(navigation).getByRole('button', { name: 'Go to next page' })
    )
    const region = screen.getByRole('region', { name: 'My Subscriptions' })
    const content = region.querySelector<HTMLElement>(
      '[data-slot="pagination-frame-content"]'
    )
    expect(content?.style.minHeight).toBe('')
    expect(
      within(region).queryByRole('button', { name: /Plan 1 · Subscription #1/ })
    ).not.toBeInTheDocument()
    await user.click(
      within(navigation).getByRole('button', { name: 'Go to previous page' })
    )
    expect(
      screen.getByRole('button', { name: /Plan 1 · Subscription #1/ })
    ).toHaveAttribute('aria-expanded', 'false')
    await user.click(
      screen.getByRole('button', { name: /Plan 1 · Subscription #1/ })
    )
    expect(
      within(
        screen.getByRole('group', { name: 'Daily quota limit' })
      ).getByRole('button')
    ).toHaveAttribute('aria-expanded', 'false')
    await user.click(
      within(navigation).getByRole('button', { name: 'Go to next page' })
    )
    expect(content?.style.minHeight).toBe('')
    const sixth = screen.getByRole('button', {
      name: /Plan 6 · Subscription #6/,
    })
    if (interaction === 'keyboard') {
      sixth.focus()
      await user.keyboard('{Enter}')
    } else {
      await user.click(sixth)
    }
    expect(sixth).toHaveAttribute('aria-expanded', 'true')
    expect(content?.style.minHeight).toBe('')
    if (interaction === 'keyboard') {
      await user.keyboard('{Enter}')
    } else {
      await user.click(sixth)
    }
    expect(sixth).toHaveAttribute('aria-expanded', 'false')
    expect(content?.style.minHeight).toBe('')
    expect(
      within(region).queryByRole('group', { name: 'Daily quota limit' })
    ).not.toBeInTheDocument()
    await user.click(
      within(navigation).getByRole('button', { name: 'Go to previous page' })
    )
    expect(
      screen.getByRole('button', { name: /Plan 1 · Subscription #1/ })
    ).toHaveAttribute('aria-expanded', 'false')
  }
)

it('aligns subscription expiry and shows total quota with the same inline details as period quotas', async () => {
  const user = userEvent.setup()
  subscriptions[0].subscription.amount_total = 5000000
  subscriptions[0].subscription.amount_used = 1000000
  subscriptions[0].subscription.next_reset_time = 1890000000
  renderWallet(<SubscriptionPlansCard topupInfo={null} />)
  await user.click(
    await screen.findByRole('button', { name: /Plan 1 · Subscription #1/ })
  )
  const region = screen.getByRole('region', { name: 'My Subscriptions' })
  const expiry = within(region).getByText('Expires at', { exact: true })
  expect(expiry.tagName).toBe('DT')
  expect(expiry.nextElementSibling?.querySelector('time')).toHaveAttribute(
    'dateTime',
    new Date(1900000000 * 1000).toISOString()
  )
  const total = within(screen.getByRole('group', { name: 'Total Quota' }))
  const daily = within(screen.getByRole('group', { name: 'Daily quota limit' }))
  expect(total.getByRole('button')).toHaveTextContent('$2 / $10')
  expect(total.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20')
  expect(total.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
  expect(total.queryByText('Remaining')).not.toBeInTheDocument()
  expect(total.queryByText('Next reset')).not.toBeInTheDocument()
  expect(screen.getAllByRole('group')).toHaveLength(4)
  await user.click(total.getByRole('button'))
  expect(total.getByText('Remaining').nextElementSibling).toHaveTextContent(
    '$8'
  )
  expect(
    total.getByText('Next reset').nextElementSibling?.querySelector('time')
  ).toHaveAttribute('dateTime', new Date(1890000000 * 1000).toISOString())
  expect(daily.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('does not automatically recommend the first plan when no recommendation is configured', async () => {
  renderWallet(<SubscriptionPlansCard topupInfo={null} />)
  await screen.findByRole('heading', { name: 'Plan 1' })
  expect(
    screen.queryByText('Recommended', { exact: true })
  ).not.toBeInTheDocument()
})

it.each([false, true])(
  'shows the explicit recommendation when it is the only plan: %s',
  async (single) => {
    plans[1].plan.recommended = true
    if (single) plans = [plans[1]]
    renderWallet(<SubscriptionPlansCard topupInfo={null} />)
    await screen.findByRole('heading', { name: 'Plan 2' })
    expect(screen.getAllByText('Recommended', { exact: true })).toHaveLength(1)
    const badge = screen.getByText('Recommended', { exact: true })
    expect(badge.closest('[data-slot="card"]')).toContainElement(
      screen.getByRole('heading', { name: 'Plan 2' })
    )
  }
)

it.each([
  {
    message: 'This plan does not allow balance redemption',
    allowBalancePay: false,
    userQuota: 50000000,
    purchaseLimit: 0,
  },
  {
    message: 'Insufficient balance',
    allowBalancePay: true,
    userQuota: 0,
    purchaseLimit: 0,
  },
  {
    message: 'Purchase limit reached',
    allowBalancePay: true,
    userQuota: 50000000,
    purchaseLimit: 1,
  },
])('centers the purchase notice for $message', async (scenario) => {
  renderWallet(
    <SubscriptionPurchaseDialog
      open
      onOpenChange={vi.fn()}
      plan={{
        plan: {
          ...plans[0].plan,
          allow_balance_pay: scenario.allowBalancePay,
        },
      }}
      userQuota={scenario.userQuota}
      purchaseLimit={scenario.purchaseLimit}
      purchaseCount={1}
    />
  )
  const dialog = await screen.findByRole('dialog')
  const notice = within(dialog).getByRole('alert')
  expect(
    within(notice).getByText(scenario.message, { exact: false })
  ).toHaveClass('text-center')
  expect(
    within(dialog).getByRole('button', { name: 'Pay with Balance' })
  ).toBeDisabled()
})

it.each([false, true])(
  'keeps the wallet position through purchase success and refresh, including an early close: %s',
  async (closeEarly) => {
    const user = userEvent.setup()
    let purchased = false
    let completePayment: (() => void) | undefined
    const payment = new Promise<void>((resolve) => {
      completePayment = resolve
    })
    let completeRefresh: (() => void) | undefined
    const refreshed = new Promise<void>((resolve) => {
      completeRefresh = resolve
    })
    const originalGet = vi.mocked(api.get).getMockImplementation()
    if (!originalGet) throw new Error('GET fixture was not initialized')
    vi.mocked(api.get).mockImplementation(async (url, config) => {
      if (
        purchased &&
        (url === '/api/subscription/self' || url === '/api/user/self')
      ) {
        await refreshed
      }
      return originalGet(url, config)
    })
    vi.spyOn(api, 'post').mockImplementation(async (url) => {
      if (url !== '/api/subscription/balance/pay') {
        throw new Error(`Unexpected POST ${url}`)
      }
      if (closeEarly) await payment
      purchased = true
      subscriptions = [
        { subscription: { ...subscriptions[0].subscription, id: 99 } },
        ...subscriptions,
      ]
      return { data: { success: true } }
    })
    const { container } = renderWallet(<Wallet />)
    await screen.findByRole('heading', { name: 'Plan 1' })
    const scroll = container.querySelector<HTMLElement>('main > .overflow-auto')
    if (!scroll) throw new Error('Wallet scroll container was not rendered')
    scroll.style.overflowY = 'auto'
    scroll.scrollTop = 650
    const purchaseButton = screen.getAllByRole('button', {
      name: 'Subscribe Now',
    })[0]
    await user.click(purchaseButton)
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Pay with Balance',
      })
    )
    if (closeEarly) {
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Close',
        })
      )
    }
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    completePayment?.()
    expect(scroll.scrollTop).toBe(650)
    expect(screen.getByText('Current Balance', { exact: true })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Subscription #99/ })
    ).not.toBeInTheDocument()
    completeRefresh?.()
    expect(
      await screen.findByRole('button', { name: /Subscription #99/ })
    ).toBeVisible()
    expect(scroll.scrollTop).toBe(650)
    expect(purchaseButton).toHaveFocus()
    await user.click(
      screen.getAllByRole('button', { name: 'Subscribe Now' })[0]
    )
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Close',
      })
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(scroll.scrollTop).toBe(650)
  }
)

it('keeps the current wallet position when a purchase fails or the dialog is cancelled', async () => {
  const user = userEvent.setup()
  vi.spyOn(api, 'post').mockResolvedValue({
    data: { success: false, message: 'Purchase limit reached' },
  })
  const { container } = renderWallet(<Wallet />)
  await screen.findByRole('heading', { name: 'Plan 1' })
  const scroll = container.querySelector<HTMLElement>('main > .overflow-auto')
  if (!scroll) throw new Error('Wallet scroll container was not rendered')
  scroll.style.overflowY = 'auto'
  scroll.scrollTop = 650
  await user.click(screen.getAllByRole('button', { name: 'Subscribe Now' })[0])
  const dialog = screen.getByRole('dialog')
  await user.click(
    within(dialog).getByRole('button', { name: 'Pay with Balance' })
  )
  await waitFor(() =>
    expect(
      within(dialog).getByRole('button', { name: 'Pay with Balance' })
    ).toBeEnabled()
  )
  expect(dialog).toBeVisible()
  expect(scroll.scrollTop).toBe(650)
  await user.click(within(dialog).getByRole('button', { name: 'Close' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
  expect(scroll.scrollTop).toBe(650)
})
