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
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { parseQuotaFromDollars } from '@/lib/format'

import { PLAN_FORM_DEFAULTS } from '../../lib/plan-form'
import { subscriptionPlanSchema } from '../../types'
import { ResetSubscriptionsDialog } from '../dialogs/reset-subscriptions-dialog'
import { ToggleStatusDialog } from '../dialogs/toggle-status-dialog'
import { SubscriptionsProvider } from '../subscriptions-provider'
import { SubscriptionsTable } from '../subscriptions-table'

const i18n = createInstance()
const longTitle = 'DeepSeek monthly subscription with a very long plan name'
let client: QueryClient
let view: ReturnType<typeof render>

function TableFixture(props: { client: QueryClient }) {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={props.client}>
        <SubscriptionsProvider>
          <SubscriptionsTable />
          <ResetSubscriptionsDialog />
          <ToggleStatusDialog />
        </SubscriptionsProvider>
      </QueryClientProvider>
    </I18nextProvider>
  )
}

beforeEach(async () => {
  localStorage.removeItem('subscriptions-table-columns-v3')
  localStorage.removeItem('subscriptions-column-sizing-v3')
  await i18n.use(initReactI18next).init({
    lng: 'en',
    resources: { en: { translation: {} } },
  })
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(['system-options'], {
    success: true,
    data: [
      { key: 'payment_setting.compliance_confirmed', value: 'true' },
      { key: 'payment_setting.compliance_terms_version', value: 'v1' },
    ],
  })
  client.setQueryData(
    ['admin-subscription-plans', 0],
    [
      {
        plan: subscriptionPlanSchema.parse({
          ...PLAN_FORM_DEFAULTS,
          id: 1,
          title: longTitle,
          subtitle: 'A detailed subtitle that must not widen the plan column',
          recommended: true,
        }),
      },
      {
        plan: subscriptionPlanSchema.parse({
          ...PLAN_FORM_DEFAULTS,
          id: 2,
          title: 'Limited plan',
          price_amount: 12,
          enabled: false,
          total_amount: parseQuotaFromDollars(100),
          daily_limit: parseQuotaFromDollars(20),
          monthly_limit: parseQuotaFromDollars(300),
        }),
      },
    ]
  )
  view = render(<TableFixture client={client} />)
})

afterEach(() => {
  client.clear()
  vi.restoreAllMocks()
  localStorage.removeItem('subscriptions-table-columns-v3')
  localStorage.removeItem('subscriptions-column-sizing-v3')
})

it('keeps total quota separate from colored period limits and exposes resizable columns', async () => {
  const user = userEvent.setup()
  const unlimited = screen.getByText(longTitle).closest('tr')
  const limited = screen.getByText('Limited plan').closest('tr')
  if (!unlimited || !limited) throw new Error('Plan rows were not rendered')
  const total = limited.querySelector('[data-column-id="total_amount"]')
  const periods = limited.querySelector('[data-column-id="period_limits"]')
  if (!(total instanceof HTMLElement) || !(periods instanceof HTMLElement)) {
    throw new Error('Separate quota columns were not rendered')
  }
  expect(within(total).getByText('$100')).toBeVisible()
  expect(within(total).queryByText(/Daily/)).not.toBeInTheDocument()
  expect(within(periods).getByTitle('Daily $20')).toHaveClass('text-info')
  expect(within(periods).getByTitle('Monthly $300')).toHaveClass('text-chart-2')
  expect(within(periods).getByTitle('Weekly Unlimited')).toBeVisible()
  expect(
    unlimited.querySelector('[data-column-id="period_limits"]')
  ).toHaveTextContent('Unlimited')
  expect(
    within(limited).getByText('Disabled').closest('[data-slot="status-badge"]')
  ).toHaveClass('text-destructive')
  const header = screen.getByRole('columnheader', { name: /^Plan/ })
  const before = header.style.width
  await user.click(
    within(header).getByRole('separator', { name: 'Resize column' })
  )
  await user.keyboard('{ArrowRight}')
  expect(header.style.width).not.toBe(before)
})

it('keeps names aligned and places the recommendation with plan status', () => {
  const title = screen.getByText(longTitle)
  const name = title.closest('[data-slot="subscription-plan-name"]')
  expect(name).toHaveClass('w-0', 'min-w-full')
  expect(title).toHaveClass('truncate')
  const row = title.closest('tr')
  if (!row) throw new Error('Subscription row was not rendered')
  const recommended = within(row).getByText('Recommended')
  expect(name).toContainElement(within(row).getByText('#1'))
  expect(name).not.toContainElement(recommended)
  expect(recommended.closest('[data-column-id="enabled"]')).toBeVisible()
  expect(within(row).getByRole('button', { name: 'Edit' })).toBeVisible()
  expect(
    within(row).getByRole('button', { name: 'Reset subscription quota' })
  ).toBeVisible()
  expect(within(row).getByRole('button', { name: 'Disable' })).toBeVisible()
  const price = screen.getByText('$12.00')
  expect(price).toHaveClass('text-success')
})

it('filters plans by name and status and restores optional columns from View', async () => {
  const user = userEvent.setup()
  const search = screen.getByPlaceholderText('Filter by name...')
  await user.type(search, 'Limited')
  expect(screen.queryByText(longTitle)).not.toBeInTheDocument()
  expect(screen.getByText('Limited plan')).toBeVisible()
  await user.clear(search)
  await user.click(screen.getAllByRole('button', { name: 'Status' })[0])
  await user.click(screen.getByRole('option', { name: /Disabled/ }))
  await user.keyboard('{Escape}')
  expect(screen.queryByText(longTitle)).not.toBeInTheDocument()
  expect(screen.getByText('Limited plan')).toBeVisible()
  expect(
    screen.queryByRole('columnheader', { name: /^ID/ })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('columnheader', { name: /^Priority/ })
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'View' }))
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'ID' }))
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Priority' }))
  await user.click(
    screen.getByRole('menuitemcheckbox', { name: 'Quota Reset' })
  )
  await user.keyboard('{Escape}')
  expect(
    screen.getByRole('columnheader', { name: /^Quota Reset/ })
  ).toBeVisible()
  expect(screen.getByRole('columnheader', { name: /^ID/ })).toBeVisible()
  expect(screen.getByRole('columnheader', { name: /^Priority/ })).toBeVisible()
  expect(screen.queryByText('#2')).not.toBeInTheDocument()
  await user.type(search, 'No matching plan')
  expect(screen.getByText('No results found.')).toBeVisible()
})

it('keeps common actions visible and opens their existing confirmation dialogs', async () => {
  const user = userEvent.setup()
  const row = screen.getByText('Limited plan').closest('tr')
  if (!row) throw new Error('Subscription row was not rendered')
  await user.click(
    within(row).getByRole('button', { name: 'Reset subscription quota' })
  )
  expect(
    await screen.findByRole('alertdialog', { name: 'Reset subscription quota' })
  ).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await user.click(within(row).getByRole('button', { name: 'Enable' }))
  expect(
    await screen.findByRole('alertdialog', { name: 'Confirm enable' })
  ).toBeVisible()
})

it('keeps plan actions disabled while compliance confirmation is missing', async () => {
  await act(async () => {
    client.setQueryData(['system-options'], { success: true, data: [] })
  })
  for (const button of screen.getAllByRole('button', { name: 'Edit' })) {
    await waitFor(() => expect(button).toBeDisabled())
  }
  for (const button of screen.getAllByRole('button', {
    name: /^(Reset subscription quota|Enable|Disable)$/,
  })) {
    expect(button).toBeDisabled()
  }
})

it('keeps phone limits in the right column as three compact complete rows', () => {
  const original = window.matchMedia
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    ...original(query),
    matches: query === '(max-width: 640px)',
  }))
  view.rerender(<TableFixture client={client} />)
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  const limits = screen.getByRole('group', {
    name: 'Subscription period quotas',
  })
  expect(limits).toHaveClass('flex-col', 'sm:grid', 'sm:grid-cols-3')
  expect(limits.closest('.grid-cols-2')?.lastElementChild).toContainElement(
    limits
  )
  expect(within(limits).getByTitle('Daily $20')).toBeVisible()
  expect(within(limits).getByTitle('Weekly Unlimited')).toBeVisible()
  expect(within(limits).getByTitle('Monthly $300')).toBeVisible()
  const labels = limits.querySelectorAll('[data-slot="status-badge"]')
  expect(labels).toHaveLength(3)
  for (const label of labels) {
    expect(label).toHaveClass('shrink-0', 'text-[11px]')
    expect(label.querySelector('.truncate')).not.toBeInTheDocument()
  }
})
