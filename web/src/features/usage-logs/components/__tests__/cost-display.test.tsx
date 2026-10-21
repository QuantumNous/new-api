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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import type React from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import { useSystemConfigStore } from '@/stores/system-config-store'

import { LogCostDisplay } from '../log-cost-display'

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({
    status: { price: 1, usd_exchange_rate: 7.2 },
  }),
}))

function renderCost(
  props: React.ComponentProps<typeof LogCostDisplay>
): ReturnType<typeof render> {
  return render(<LogCostDisplay {...props} />)
}

describe('log cost display', () => {
  beforeAll(() => {
    i18next.addResourceBundle('en', 'translation', {
      Subscription: 'Subscription',
      Wallet: 'Wallet',
      'Includes tool-call surcharge': 'Includes tool-call surcharge',
      'Official price estimate': 'Official price estimate',
      Savings: 'Savings',
    })
  })

  beforeEach(() => {
    useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  })

  afterEach(() => {
    useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
    localStorage.clear()
  })

  test.each([
    { consumed: 12500, expected: '¥0.025' },
    { consumed: 0, expected: '¥0' },
    { consumed: 1, expected: '¥0.000002' },
    { consumed: undefined, expected: '¥0.01' },
  ])(
    'shows subscription deduction $consumed without hover, falling back only when absent',
    ({ consumed, expected }) => {
      renderCost({
        quota: 5000,
        other: {
          billing_source: 'subscription',
          subscription_consumed: consumed,
        },
        showBillingSource: true,
      })

      expect(screen.getByText(expected)).toBeVisible()
      expect(screen.getByRole('img', { name: 'Subscription' })).toBeVisible()
      expect(screen.queryByText('Subscription')).not.toBeInTheDocument()
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    }
  )

  test('shows wallet cost and source icon without using subscription metadata', () => {
    renderCost({
      quota: 5000,
      other: { billing_source: 'wallet', subscription_consumed: 12500 },
      showBillingSource: true,
    })

    expect(screen.getByText('¥0.01')).toBeVisible()
    expect(screen.getByRole('img', { name: 'Wallet' })).toBeVisible()
    expect(screen.queryByText('Wallet')).not.toBeInTheDocument()
    expect(screen.queryByText('Subscription')).not.toBeInTheDocument()
  })

  test('hides the wallet icon when subscriptions are unavailable', () => {
    renderCost({
      quota: 5000,
      other: { billing_source: 'wallet' },
      showBillingSource: false,
    })

    expect(screen.getByText('¥0.01')).toBeVisible()
    expect(screen.queryByText('Wallet')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  test('keeps the subscription icon on a subscription-billed log when billing sources are hidden', () => {
    renderCost({
      quota: 5000,
      other: { billing_source: 'subscription', subscription_consumed: 12500 },
      showBillingSource: false,
    })

    expect(screen.getByText('¥0.025')).toBeVisible()
    expect(screen.getByRole('img', { name: 'Subscription' })).toBeVisible()
    expect(screen.queryByRole('img', { name: 'Wallet' })).not.toBeInTheDocument()
  })

  test('keeps legacy cost visible without inventing a funding source', () => {
    renderCost({ quota: 5000, other: null })

    expect(screen.getByText('¥0.01')).toBeVisible()
    expect(screen.queryByText('Wallet')).not.toBeInTheDocument()
    expect(screen.queryByText('Subscription')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  test('keeps a large amount unabridged in a single-line cost bubble', () => {
    const rendered = renderCost({
      quota: 2147483647,
      other: { billing_source: 'subscription' },
      showBillingSource: true,
    })

    const amount = screen.getByText('¥4,294.9673')
    expect(amount).toBeVisible()
    expect(amount).toHaveClass('whitespace-nowrap')
    expect(amount.closest('[data-slot="status-badge"]')).toHaveClass(
      'border',
      'rounded-md',
      'tabular-nums'
    )
    expect(rendered.container.firstElementChild).toHaveClass('inline-flex')
    expect(rendered.container.firstElementChild).not.toHaveClass('flex-col')
    expect(screen.getByRole('img', { name: 'Subscription' })).toBeVisible()
  })

  test.each([
    { source: 'subscription', label: 'Subscription' },
    { source: 'wallet', label: 'Wallet' },
  ])(
    'vertically centers the $source icon within its container',
    ({ source, label }) => {
      renderCost({
        quota: 5000,
        other: { billing_source: source },
        showBillingSource: true,
      })

      // Mobile cards give inline-flex descendants a minimum height, so the
      // source container must center its smaller icon independently of the badge.
      expect(screen.getByRole('img', { name: label })).toHaveClass(
        'inline-flex',
        'items-center'
      )
    }
  )

  test.each([
    { source: 'subscription', label: 'Subscription' },
    { source: 'wallet', label: 'Wallet' },
  ])(
    'reveals the $source label on hover and keyboard focus',
    async ({ source, label }) => {
      const user = userEvent.setup()
      renderCost({
        quota: 5000,
        other: { billing_source: source },
        showBillingSource: true,
      })

      const marker = screen.getByRole('img', { name: label })
      expect(screen.queryByText(label)).not.toBeInTheDocument()

      await user.hover(marker)
      expect(await screen.findByText(label)).toBeVisible()
      await user.unhover(marker)
      await waitFor(() =>
        expect(screen.queryByText(label)).not.toBeInTheDocument()
      )
      await user.tab()
      expect(marker).toHaveFocus()
      expect(await screen.findByText(label)).toBeVisible()
    }
  )

  test('keeps the regular cost visible and adds an accessible surcharge marker', () => {
    renderCost({
      quota: 12500,
      other: {
        tool_surcharges: [{ name: 'lookup_customer', count: 1, price: 5 }],
      },
    })

    expect(screen.getByText('¥0.025')).toBeVisible()
    const marker = screen.getByRole('img', {
      name: 'Includes tool-call surcharge',
    })
    expect(marker).toHaveAttribute('data-tool-surcharge-indicator', 'true')
    expect(marker).toHaveAttribute('tabindex', '0')
  })

  test('shows subscription cost and source alongside the legacy surcharge marker', () => {
    renderCost({
      quota: 5000,
      other: {
        billing_source: 'subscription',
        web_search: true,
        web_search_call_count: 1,
        web_search_price: 10,
      },
      showBillingSource: true,
    })

    expect(screen.getByText('¥0.01')).toBeVisible()
    expect(screen.getByRole('img', { name: 'Subscription' })).toBeVisible()
    expect(
      screen.getByRole('img', { name: 'Includes tool-call surcharge' })
    ).toHaveAttribute('data-tool-surcharge-indicator', 'true')
  })

  test('compares CNY reference prices with the CNY charge for Chinese models', () => {
    renderCost({
      modelName: 'qwen3-coder',
      quota: 100,
      other: { group_ratio: 0.25 },
    })

    expect(screen.getByText('Official price')).toBeVisible()
    expect(screen.getByText(/^Yecai price/)).toBeVisible()
    expect(screen.getByText('Cheaper by 75%')).toBeVisible()
    expect(screen.queryByText(/¥0\.0006/)).not.toBeInTheDocument()
    expect(screen.getByTestId('log-savings-comparison')).toHaveAttribute(
      'aria-label',
      'Cheaper by 75%'
    )
    expect(
      screen.queryByText(/^Site base price estimate/)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/^Official price estimate/)
    ).not.toBeInTheDocument()
  })

  test.each([
    'claude-sonnet-4-5',
    'openai/gpt-6-astra',
    'gemini-2.5-pro',
    'grok-4',
  ])(
    'shows the native official USD price for %s while comparing at 6.75',
    (modelName) => {
      renderCost({ modelName, quota: 1350, other: { group_ratio: 0.5 } })
      expect(screen.getByText('Official price')).toBeVisible()
      expect(screen.getByText('$0.0054')).toBeVisible()
      expect(screen.getByText('Yecai price ¥0.0027')).toBeVisible()
      expect(screen.getByText('Cheaper by 92.59%')).toBeVisible()
      expect(screen.queryByText('¥0.0365')).not.toBeInTheDocument()
    }
  )

  test('includes the currency conversion in savings without a group discount', () => {
    renderCost({
      modelName: 'claude-sonnet-4-5',
      quota: 1350,
      other: { group_ratio: 1 },
    })
    expect(screen.getByText('$0.0027')).toBeVisible()
    expect(screen.getByText('Yecai price ¥0.0027')).toBeVisible()
    expect(screen.getByText('Cheaper by 85.19%')).toBeVisible()
  })

  test('does not apply a USD exchange rate to an unknown model', () => {
    renderCost({
      modelName: 'private-model',
      quota: 1350,
      other: { group_ratio: 0.5 },
    })
    expect(screen.getByText('Official price')).toBeVisible()
    expect(screen.getByText('¥0.0054')).toBeVisible()
    expect(screen.queryByText(/Reference price/)).not.toBeInTheDocument()
  })

  test('preserves the native USD amount and exchange-aware savings for a 1.2x group', () => {
    renderCost({
      modelName: 'claude-sonnet-4-5',
      quota: 9160,
      other: { group_ratio: 1.2 },
    })
    expect(screen.getByText('$0.015267')).toBeVisible()
    expect(screen.getByText('Yecai price ¥0.0183')).toBeVisible()
    expect(screen.getByText('Cheaper by 82.22%')).toBeVisible()
  })

  test.each(['gpt-image-1', 'qwen-image', 'private-model'])(
    'shows only the CNY charge for per-request billing of %s',
    (modelName) => {
      renderCost({
        modelName,
        quota: 12500,
        other: { model_price: 0.05, group_ratio: 0.5 },
      })
      expect(screen.getByText('Yecai price')).toBeVisible()
      expect(screen.getByText('¥0.025')).toBeVisible()
      expect(screen.queryByText('Official price')).not.toBeInTheDocument()
      expect(screen.queryByText(/Cheaper by/)).not.toBeInTheDocument()
      expect(
        screen.queryByTestId('log-savings-comparison')
      ).not.toBeInTheDocument()
    }
  )

  test.each([
    [0, { group_ratio: 0.5 }],
    [100, { group_ratio: 0.5, fee_quota: 0 }],
  ])(
    'shows a plain zero cost when the recorded charge is zero',
    (quota, other) => {
      renderCost({ quota, other })
      expect(screen.getByText('Cost 0')).toBeVisible()
      expect(screen.queryByText('Yecai price')).not.toBeInTheDocument()
      expect(screen.queryByText('Official price')).not.toBeInTheDocument()
      expect(screen.queryByText(/Cheaper by/)).not.toBeInTheDocument()
    }
  )

  test('retains subscription billing rather than calling it a zero cash price', () => {
    renderCost({ quota: 0, other: { billing_source: 'subscription' } })
    expect(screen.getByRole('img', { name: 'Subscription' })).toBeVisible()
    expect(screen.queryByText('Cost 0')).not.toBeInTheDocument()
  })

  test('does not invent a percentage when the recorded reference is missing or zero', () => {
    renderCost({ quota: 100, other: { group_ratio: 0 } })
    expect(screen.queryByText(/Cheaper by/)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/^Site base price estimate/)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/^Official price estimate/)
    ).not.toBeInTheDocument()
  })
})
