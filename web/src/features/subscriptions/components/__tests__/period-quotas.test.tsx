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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { expect, it, vi } from 'vitest'

import en from '@/i18n/locales/en.json'
import fr from '@/i18n/locales/fr.json'
import ja from '@/i18n/locales/ja.json'
import ru from '@/i18n/locales/ru.json'
import viLocale from '@/i18n/locales/vi.json'
import zhTW from '@/i18n/locales/zh-TW.json'
import zh from '@/i18n/locales/zh.json'
import { api } from '@/lib/api'
import { formatQuota, parseQuotaFromDollars } from '@/lib/format'

import { PLAN_FORM_DEFAULTS } from '../../lib/plan-form'
import { SubscriptionQuotaSummary } from '../subscription-quota-summary'
import { SubscriptionsMutateDrawer } from '../subscriptions-mutate-drawer'
import { SubscriptionsProvider } from '../subscriptions-provider'

const interfaceI18n = createInstance()
await interfaceI18n
  .use(initReactI18next)
  .init({ lng: 'en', resources: { en: { translation: {} } } })

it('keeps paired plan fields top-aligned in separate group and purchase rows', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: [] },
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['system-options'], { success: true, data: [] })
  render(
    <I18nextProvider i18n={interfaceI18n}>
      <QueryClientProvider client={client}>
        <SubscriptionsProvider>
          <SubscriptionsMutateDrawer open onOpenChange={vi.fn()} />
        </SubscriptionsProvider>
      </QueryClientProvider>
    </I18nextProvider>
  )
  const upgrade = await screen.findByLabelText('Upgrade Group')
  const downgrade = screen.getByLabelText('Downgrade Group')
  const limit = screen.getByLabelText('Purchase Limit')
  const order = screen.getByLabelText('Sort Order')
  const groupRow = upgrade.closest('[data-slot="form-item"]')?.parentElement
  const purchaseRow = limit.closest('[data-slot="form-item"]')?.parentElement
  expect(groupRow).toHaveClass('items-start')
  expect(downgrade.closest('[data-slot="form-item"]')?.parentElement).toBe(
    groupRow
  )
  expect(purchaseRow).not.toBe(groupRow)
  expect(purchaseRow).toHaveClass('grid-cols-2', 'items-start')
  expect(order.closest('[data-slot="form-item"]')?.parentElement).toBe(
    purchaseRow
  )
  client.clear()
})

it('saves the three displayed currency amounts as integer quota values', async () => {
  const posted = vi
    .spyOn(api, 'post')
    .mockResolvedValue({ data: { success: true } })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/group') return { data: { success: true, data: [] } }
    if (url === '/api/option/waffo-pancake/subscription-product-options') {
      return { data: { message: 'success', data: { products: [] } } }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['system-options'], { success: true, data: [] })
  const close = vi.fn()
  render(
    <I18nextProvider i18n={interfaceI18n}>
      <QueryClientProvider client={client}>
        <SubscriptionsProvider>
          <SubscriptionsMutateDrawer open onOpenChange={close} />
        </SubscriptionsProvider>
      </QueryClientProvider>
    </I18nextProvider>
  )
  fireEvent.change(await screen.findByLabelText('Plan Title'), {
    target: { value: 'Period plan' },
  })
  for (const [label, value] of [
    ['Daily quota limit', '10.25'],
    ['Weekly quota limit', '50'],
    ['Monthly quota limit', '100'],
  ]) {
    fireEvent.change(screen.getByLabelText(`${label} (USD)`), {
      target: { value },
    })
  }
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() =>
    expect(posted).toHaveBeenCalledWith(
      '/api/subscription/admin/plans',
      expect.objectContaining({
        plan: expect.objectContaining({
          daily_limit: parseQuotaFromDollars(10.25),
          weekly_limit: parseQuotaFromDollars(50),
          monthly_limit: parseQuotaFromDollars(100),
        }),
      })
    )
  )
  expect(close).toHaveBeenCalledWith(false)
  client.clear()
})

it.each([
  ['en', en],
  ['zhCN', zh],
  ['zhTW', zhTW],
  ['fr', fr],
  ['ja', ja],
  ['ru', ru],
  ['vi', viLocale],
  ['invalid_locale', en],
] as const)(
  'shows remaining quota and Beijing reset times in %s',
  async (language, resource) => {
    const i18n = createInstance()
    await i18n.use(initReactI18next).init({
      lng: language,
      fallbackLng: 'en',
      resources: { [language]: resource, en },
    })
    const limit = parseQuotaFromDollars(10)
    const used = parseQuotaFromDollars(4)
    const resetAt = Date.parse('2026-11-01T16:00:00Z') / 1000
    const window = { limit, used, reset_at: resetAt }
    render(
      <I18nextProvider i18n={i18n}>
        <SubscriptionQuotaSummary
          windows={{ daily: window, weekly: window, monthly: window }}
        />
      </I18nextProvider>
    )
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: `${i18n.t('Daily quota limit')}: ${formatQuota(used)} / ${formatQuota(limit)}`,
        })
      )
    })
    const daily = within(
      screen.getByRole('group', { name: i18n.t('Daily quota limit') })
    )
    expect(
      daily.getByText(i18n.t('Remaining')).nextElementSibling
    ).toHaveTextContent(formatQuota(limit - used))
    const reset = daily.getByText(i18n.t('Next reset')).nextElementSibling
    expect(reset).toHaveTextContent(/\b00:00\b/)
    expect(reset).toHaveTextContent(/\b(?:GMT|UTC)\+8\b/)
    expect(daily.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '40'
    )
    expect(screen.getAllByRole('group')).toHaveLength(3)
    expect(i18n.t('Daily quota limit')).toBe(
      resource.translation['Daily quota limit']
    )
    expect(
      i18n.t(
        'Period quota limits must be non-negative amounts within the supported range'
      )
    ).toBe(
      resource.translation[
        'Period quota limits must be non-negative amounts within the supported range'
      ]
    )
  }
)

it('keeps the Beijing timezone marker visible when the interface language changes', async () => {
  const i18n = createInstance()
  await i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en, fr },
  })
  const window = {
    limit: 0,
    used: 0,
    reset_at: Date.parse('2026-11-01T16:00:00Z') / 1000,
  }
  render(
    <I18nextProvider i18n={i18n}>
      <SubscriptionQuotaSummary
        windows={{ daily: window, weekly: window, monthly: window }}
      />
    </I18nextProvider>
  )
  const daily = screen.getByRole('group', { name: 'Daily quota limit' })
  await userEvent.click(within(daily).getByRole('button'))
  const reset = daily.querySelector('time')
  expect(reset).toHaveTextContent(/\bGMT\+8\b/)

  await act(async () => {
    await i18n.changeLanguage('fr')
  })

  expect(within(daily).getByText(i18n.t('Next reset'))).toBeVisible()
  expect(reset).toHaveTextContent(/\b00:00\b/)
  expect(reset).toHaveTextContent(/\bUTC\+8\b/)
  expect(reset).toHaveAttribute('datetime', '2026-11-01T16:00:00.000Z')
})

it('shows midnight as 00:00 when the runtime defaults to the h24 clock', async () => {
  const DateTimeFormat = Intl.DateTimeFormat
  const legacyFormatter = vi
    .spyOn(Intl, 'DateTimeFormat')
    .mockImplementation(function (locales, options) {
      // Legacy V8 uses h24 for en-US when only hour12: false is specified.
      return new DateTimeFormat(locales, {
        ...options,
        hour12: undefined,
        hourCycle:
          options?.hour12 === false ? 'h24' : (options?.hourCycle ?? 'h24'),
      })
    })
  const window = {
    limit: 0,
    used: 0,
    reset_at: Date.parse('2026-11-01T16:00:00Z') / 1000,
  }
  try {
    render(
      <I18nextProvider i18n={interfaceI18n}>
        <SubscriptionQuotaSummary
          windows={{ daily: window, weekly: window, monthly: window }}
        />
      </I18nextProvider>
    )
    const daily = within(
      screen.getByRole('group', { name: 'Daily quota limit' })
    )
    await userEvent.click(daily.getByRole('button'))
    const reset = daily.getByText('Next reset').nextElementSibling
    expect(reset).toHaveTextContent(/\b00:00\b/)
    expect(reset?.querySelector('time')).toHaveAttribute(
      'datetime',
      '2026-11-01T16:00:00.000Z'
    )
  } finally {
    legacyFormatter.mockRestore()
  }
})

it('shows plan limits once without an overlay trigger or repeated heading', () => {
  render(
    <I18nextProvider i18n={interfaceI18n}>
      <SubscriptionQuotaSummary
        plan={{
          daily_limit: parseQuotaFromDollars(20),
          weekly_limit: parseQuotaFromDollars(100),
          monthly_limit: parseQuotaFromDollars(300),
        }}
      />
    </I18nextProvider>
  )
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(
    screen.queryByText('Subscription period quotas')
  ).not.toBeInTheDocument()
  for (const amount of [20, 100, 300]) {
    expect(
      screen.getAllByText(formatQuota(parseQuotaFromDollars(amount)))
    ).toHaveLength(1)
  }
})

it('expands a period in place with the keyboard and collapses it without opening a dialog', async () => {
  const user = userEvent.setup()
  const window = {
    limit: parseQuotaFromDollars(10),
    used: 0,
    reset_at: Date.parse('2026-11-01T16:00:00Z') / 1000,
  }
  const { container } = render(
    <I18nextProvider i18n={interfaceI18n}>
      <SubscriptionQuotaSummary
        windows={{ daily: window, weekly: window, monthly: window }}
      />
    </I18nextProvider>
  )
  const daily = within(screen.getByRole('group', { name: 'Daily quota limit' }))
  const trigger = daily.getByRole('button')
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(daily.queryByText('Remaining')).not.toBeInTheDocument()
  await user.tab()
  expect(trigger).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  expect(daily.getByText('Remaining')).toBeVisible()
  expect(container).toContainElement(daily.getByText('Remaining'))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(
    within(screen.getByRole('group', { name: 'Weekly quota limit' })).getByRole(
      'button'
    )
  ).toHaveAttribute('aria-expanded', 'false')
  await user.keyboard(' ')
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(trigger).toHaveFocus()
})

it('shows unlimited periods without a progress bar and clamps exhausted remaining quota', async () => {
  const limit = parseQuotaFromDollars(10)
  const reset_at = Date.parse('2026-11-01T16:00:00Z') / 1000
  render(
    <I18nextProvider i18n={interfaceI18n}>
      <SubscriptionQuotaSummary
        windows={{
          daily: { limit: 0, used: limit, reset_at },
          weekly: { limit, used: limit * 2, reset_at },
          monthly: { limit, used: 0, reset_at },
        }}
      />
    </I18nextProvider>
  )
  await act(async () => {
    fireEvent.click(
      within(
        screen.getByRole('group', { name: 'Daily quota limit' })
      ).getByRole('button')
    )
  })
  const daily = within(screen.getByRole('group', { name: 'Daily quota limit' }))
  expect(daily.queryByRole('progressbar')).not.toBeInTheDocument()
  expect(daily.getByText('Remaining').nextElementSibling).toHaveTextContent(
    'Unlimited'
  )
  const weekly = within(
    screen.getByRole('group', { name: 'Weekly quota limit' })
  )
  await act(async () => {
    fireEvent.click(weekly.getByRole('button'))
  })
  expect(weekly.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '100'
  )
  expect(weekly.getByText('Remaining').nextElementSibling).toHaveTextContent(
    formatQuota(0)
  )
})

it('omits unchanged limits on an ordinary edit and sends zero to disable a changed limit', async () => {
  const put = vi
    .spyOn(api, 'put')
    .mockResolvedValue({ data: { success: true } })
  vi.spyOn(api, 'get').mockResolvedValue({ data: { success: true, data: [] } })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['system-options'], { success: true, data: [] })
  const { subscriptionPlanSchema } = await import('../../types')
  const plan = subscriptionPlanSchema.parse({
    ...PLAN_FORM_DEFAULTS,
    id: 1,
    title: 'Existing',
    recommended: true,
    daily_limit: parseQuotaFromDollars(10),
    weekly_limit: parseQuotaFromDollars(20),
    monthly_limit: parseQuotaFromDollars(30),
  })
  render(
    <I18nextProvider i18n={interfaceI18n}>
      <QueryClientProvider client={client}>
        <SubscriptionsProvider>
          <SubscriptionsMutateDrawer
            open
            onOpenChange={vi.fn()}
            currentRow={{ plan }}
          />
        </SubscriptionsProvider>
      </QueryClientProvider>
    </I18nextProvider>
  )
  fireEvent.change(await screen.findByLabelText('Plan Title'), {
    target: { value: 'Renamed' },
  })
  fireEvent.change(screen.getByLabelText('Weekly quota limit (USD)'), {
    target: { value: '0' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(put).toHaveBeenCalledOnce())
  const payload = put.mock.calls[0]?.[1] as { plan: Record<string, unknown> }
  expect(payload.plan).not.toHaveProperty('daily_limit')
  expect(payload.plan).not.toHaveProperty('recommended')
  expect(payload.plan).not.toHaveProperty('monthly_limit')
  expect(payload.plan.weekly_limit).toBe(0)
  client.clear()
})

it.each([0.001, 0.000002])(
  'allows a title edit when existing period limits are %s USD',
  async (amount) => {
    const put = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true } })
    vi.spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: [] },
    })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    client.setQueryData(['system-options'], { success: true, data: [] })
    const { subscriptionPlanSchema } = await import('../../types')
    const quota = parseQuotaFromDollars(amount)
    const plan = subscriptionPlanSchema.parse({
      ...PLAN_FORM_DEFAULTS,
      id: 1,
      title: 'Precise plan',
      daily_limit: quota,
      weekly_limit: quota,
      monthly_limit: quota,
    })
    render(
      <I18nextProvider i18n={interfaceI18n}>
        <QueryClientProvider client={client}>
          <SubscriptionsProvider>
            <SubscriptionsMutateDrawer
              open
              onOpenChange={vi.fn()}
              currentRow={{ plan }}
            />
          </SubscriptionsProvider>
        </QueryClientProvider>
      </I18nextProvider>
    )
    for (const label of [
      'Daily quota limit',
      'Weekly quota limit',
      'Monthly quota limit',
    ]) {
      const input = await screen.findByLabelText<HTMLInputElement>(
        `${label} (USD)`
      )
      expect(input.valueAsNumber).toBe(amount)
      expect(input.validity.stepMismatch).toBe(false)
    }
    fireEvent.change(screen.getByLabelText('Plan Title'), {
      target: { value: 'Renamed precise plan' },
    })
    expect(
      screen
        .getByRole<HTMLButtonElement>('button', { name: 'Save changes' })
        .form?.checkValidity()
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(put).toHaveBeenCalledOnce())
    const payload = put.mock.calls[0]?.[1] as { plan: Record<string, unknown> }
    expect(payload.plan.title).toBe('Renamed precise plan')
    expect(payload.plan).not.toHaveProperty('daily_limit')
    expect(payload.plan).not.toHaveProperty('weekly_limit')
    expect(payload.plan).not.toHaveProperty('monthly_limit')
    client.clear()
  }
)

it.each([10, 0])(
  'shows a standalone total quota of %s USD without a reset time or overlay',
  async (amount) => {
    const user = userEvent.setup()
    const limit = parseQuotaFromDollars(amount)
    const used = parseQuotaFromDollars(4)
    render(
      <I18nextProvider i18n={interfaceI18n}>
        <SubscriptionQuotaSummary total={{ limit, used }} />
      </I18nextProvider>
    )
    const total = within(screen.getByRole('group', { name: 'Total Quota' }))
    expect(total.getByRole('button')).toHaveTextContent(
      `${formatQuota(used)} / ${amount > 0 ? formatQuota(limit) : 'Unlimited'}`
    )
    expect(total.queryByText('Remaining')).not.toBeInTheDocument()
    await user.click(total.getByRole('button'))
    expect(total.getByText('Remaining').nextElementSibling).toHaveTextContent(
      amount > 0 ? formatQuota(limit - used) : 'Unlimited'
    )
    expect(total.queryByText('Next reset')).not.toBeInTheDocument()
    if (amount > 0) {
      expect(total.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '40'
      )
    } else {
      expect(total.queryByRole('progressbar')).not.toBeInTheDocument()
    }
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  }
)

it('defaults the recommendation switch off and clears it when disabling a plan', async () => {
  const user = userEvent.setup()
  const posted = vi
    .spyOn(api, 'post')
    .mockResolvedValue({ data: { success: true } })
  vi.spyOn(api, 'get').mockResolvedValue({ data: { success: true, data: [] } })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['system-options'], { success: true, data: [] })
  render(
    <I18nextProvider i18n={interfaceI18n}>
      <QueryClientProvider client={client}>
        <SubscriptionsProvider>
          <SubscriptionsMutateDrawer open onOpenChange={vi.fn()} />
        </SubscriptionsProvider>
      </QueryClientProvider>
    </I18nextProvider>
  )
  const recommended = screen.getByRole('switch', { name: 'Recommended' })
  const enabled = screen.getByRole('switch', { name: 'Enabled Status' })
  expect(recommended).not.toBeChecked()
  await user.click(recommended)
  expect(recommended).toBeChecked()
  await user.click(enabled)
  expect(recommended).not.toBeChecked()
  expect(recommended).toHaveAttribute('aria-disabled', 'true')
  await user.click(enabled)
  expect(recommended).not.toHaveAttribute('aria-disabled', 'true')
  expect(recommended).not.toBeChecked()
  await user.click(recommended)
  await user.type(screen.getByLabelText('Plan Title'), 'Selected')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() =>
    expect(posted).toHaveBeenCalledWith(
      '/api/subscription/admin/plans',
      expect.objectContaining({
        plan: expect.objectContaining({ recommended: true }),
      })
    )
  )
  client.clear()
})
