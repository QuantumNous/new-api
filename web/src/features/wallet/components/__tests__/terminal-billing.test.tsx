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
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'
import { createTestAuthBundle } from '@/test-utils/auth-bundle'

import { TerminalBilling } from '../terminal-billing'

const originalAdapter = api.defaults.adapter
const originalConfig = useSystemConfigStore.getState().config
let client: QueryClient
let summaryQuota = 2935
let savedQuota = 1390
let summaryFails = false

beforeEach(() => {
  summaryQuota = 2935
  savedQuota = 1390
  summaryFails = false
  useAuthStore.getState().auth.setBundle(createTestAuthBundle())
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
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  api.defaults.adapter = async (config) => {
    if (config.url !== '/api/log/self/summary') {
      throw new Error(`Unexpected request: ${config.url}`)
    }
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: summaryFails
        ? { success: false, message: 'Summary unavailable' }
        : {
            success: true,
            data: {
              requests: summaryQuota ? 3 : 0,
              succeeded: summaryQuota ? 3 : 0,
              failed: 0,
              quota: summaryQuota,
              saved_quota: savedQuota,
              tokens: 100,
              comparable_requests: summaryQuota ? 3 : 0,
              daily: [],
            },
          },
    }
  }
})

afterEach(async () => {
  cleanup()
  client.clear()
  api.defaults.adapter = originalAdapter
  useAuthStore.getState().auth.reset()
  useSystemConfigStore.setState({ config: originalConfig })
  await i18next.changeLanguage('en')
})

function renderBilling(usedQuota: number | undefined = 9900) {
  return render(
    <QueryClientProvider client={client}>
      <TerminalBilling remainQuota={6280} usedQuota={usedQuota}>
        <section id='topup'>Recharge form</section>
      </TerminalBilling>
    </QueryClientProvider>
  )
}

describe('easy wallet overview', () => {
  test.each(['zhCN', 'zhTW'])(
    'renders currency with the project language code %s without a runtime error',
    async (language) => {
      await i18next.changeLanguage(language)
      renderBilling()

      expect(screen.getByText('¥62.80')).toBeVisible()
      expect(
        await screen.findByText('Saved ¥13.90 in the last 10 days')
      ).toBeVisible()
    }
  )

  test('prioritizes the balance and top-up action with a compact savings summary', async () => {
    renderBilling()

    const balance = screen.getByRole('region', { name: 'Available balance' })
    expect(within(balance).getByText('¥62.80')).toBeVisible()
    expect(
      within(balance).getByRole('link', { name: 'Top up' })
    ).toHaveAttribute('href', '#topup')
    expect(screen.getByText('Lifetime spending')).toBeVisible()
    expect(screen.getByText('¥99.00')).toBeVisible()
    expect(
      await screen.findByText('Saved ¥13.90 in the last 10 days')
    ).toBeVisible()
    expect(screen.getByText('(32%)')).toBeVisible()
    expect(screen.queryByText('If you paid list price')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'What you spent' })
    ).not.toBeInTheDocument()
  })

  test('does not infer balance or lifetime spending from recent usage while the account is loading', async () => {
    render(
      <QueryClientProvider client={client}>
        <TerminalBilling remainQuota={undefined} usedQuota={undefined} loading>
          <section id='topup'>Recharge form</section>
        </TerminalBilling>
      </QueryClientProvider>
    )

    await screen.findByText('Saved ¥13.90 in the last 10 days')
    const balance = screen.getByRole('region', { name: 'Available balance' })
    expect(balance).toHaveAttribute('aria-busy', 'true')
    expect(within(balance).getAllByText('—')).toHaveLength(2)
    expect(within(balance).queryByText('¥0.00')).not.toBeInTheDocument()
  })

  test('opens savings details from the keyboard and hides them again without navigation', async () => {
    const user = userEvent.setup()
    renderBilling()
    await screen.findByText('Saved ¥13.90 in the last 10 days')
    const trigger = screen.getByRole('button', { name: 'View details' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    trigger.focus()
    await user.keyboard('{Enter}')

    expect(
      screen.getByRole('button', { name: 'Hide details' })
    ).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('You actually paid')).toBeVisible()
    expect(screen.getByText('¥29.35')).toBeVisible()
    expect(screen.getByText('If you paid list price')).toBeVisible()
    expect(screen.getByText('¥43.25')).toBeVisible()
    expect(
      screen.getByText('Last 10 days · recorded request rates')
    ).toBeVisible()

    await user.keyboard(' ')

    await waitFor(() =>
      expect(
        screen.queryByText('If you paid list price')
      ).not.toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: 'View details' })).toHaveFocus()
  })

  test('uses account lifetime spending rather than replacing it with recent spending', async () => {
    renderBilling(1500)

    expect(screen.getByText('¥15.00')).toBeVisible()
    await screen.findByText('Saved ¥13.90 in the last 10 days')
    expect(screen.queryByText('¥29.35')).not.toBeInTheDocument()
  })

  test('keeps an empty savings summary compact without inventing a percentage', async () => {
    summaryQuota = 0
    savedQuota = 0
    renderBilling(0)

    expect(
      await screen.findByText('Saved ¥0.00 in the last 10 days')
    ).toBeVisible()
    expect(screen.queryByText(/\(.*%\)/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Nothing spent yet' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('Recharge form')).toBeVisible()
  })

  test('keeps the balance usable when savings cannot load and does not show fake zero savings', async () => {
    summaryFails = true
    renderBilling()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Savings unavailable'
    )
    expect(screen.getByText('¥62.80')).toBeVisible()
    expect(
      screen.queryByText('Saved ¥0.00 in the last 10 days')
    ).not.toBeInTheDocument()
    expect(screen.getByText('Recharge form')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'View details' })
    ).not.toBeInTheDocument()
  })
})
