/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { focusManager, QueryClient } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CashbackActivityPage } from '@/features/cashback-activity'
import zh from '@/i18n/locales/zh.json'
import { Route } from '@/routes/activity'
import { useAuthStore } from '@/stores/auth-store'
import { createTestAuthBundle } from '@/test-utils/auth-bundle'
import { renderApp } from '@/test-utils/render-app'

const { getPublicCashbackOffers } = vi.hoisted(() => ({
  getPublicCashbackOffers: vi.fn(),
}))
vi.mock('@/features/cashback/api', () => ({ getPublicCashbackOffers }))

let client: QueryClient
const originalAuth = useAuthStore.getState()

beforeEach(() => {
  getPublicCashbackOffers.mockReset()
  getPublicCashbackOffers.mockResolvedValue({ active: false, currency: 'CNY' })
  useAuthStore.getState().auth.reset()
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  client.setQueryData(['status'], {}, { updatedAt: Date.now() + 60_000 })
})

afterEach(async () => {
  client.clear()
  useAuthStore.setState(originalAuth)
  await act(() => i18next.changeLanguage('en'))
})

describe('public cashback activity page', () => {
  it('registers a public route and links guests to registration without claiming fixed rewards', async () => {
    expect(Route.options.component).toBe(CashbackActivityPage)
    await renderApp(<CashbackActivityPage />, client)

    expect(
      await screen.findByText('No active cashback offers right now.')
    ).toBeVisible()
    expect(
      screen.getByText('No active top-up payer offer right now.')
    ).toBeVisible()
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Top-up and inviter cashback',
      })
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Top-up rewards' })
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Invite rewards' })
    ).toBeVisible()
    expect(
      screen.getByText(/current campaign, eligibility and limits/)
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute(
      'href',
      '/sign-up'
    )
    expect(
      within(
        screen.getByRole('navigation', { name: 'Main navigation' })
      ).getByRole('link', { name: 'Offers' })
    ).toHaveAttribute('aria-current', 'page')
  })

  it('updates the navigation and both offer descriptions when language changes', async () => {
    i18next.addResourceBundle('zhCN', 'translation', zh.translation, true, true)
    await renderApp(<CashbackActivityPage />, client)

    await act(() => i18next.changeLanguage('zhCN'))

    expect(
      within(screen.getByRole('navigation', { name: '主导航' })).getByRole(
        'link',
        { name: '活动' }
      )
    ).toHaveAttribute('href', '/activity')
    expect(screen.getByRole('heading', { name: '充值返现' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '邀请返现' })).toBeVisible()
    expect(screen.getByText('目前没有生效的返现优惠。')).toBeVisible()
  })

  it('shows only active directions and exact cent tiers from the public response', async () => {
    getPublicCashbackOffers.mockResolvedValue({
      active: true,
      currency: 'CNY',
      inviter: {
        strategy: 'tiered',
        tiers: [
          { threshold_cents: 10050, reward_cents: 250 },
          { threshold_cents: 20000, reward_cents: 1500 },
        ],
      },
    })
    await renderApp(<CashbackActivityPage />, client)
    expect(await screen.findByText(/¥100\.50.*¥2\.50/)).toBeVisible()
    expect(screen.getByText(/¥200\.00.*¥15\.00/)).toBeVisible()
    expect(
      screen.getByText('No active top-up payer offer right now.')
    ).toBeVisible()
    expect(
      screen.queryByText('No active cashback offers right now.')
    ).not.toBeInTheDocument()
  })

  it('replaces live rules with inactive status after a scheduled refresh on the same page', async () => {
    getPublicCashbackOffers
      .mockResolvedValueOnce({
        active: true,
        currency: 'CNY',
        invitee: { strategy: 'rate', rate_bps: 1250 },
      })
      .mockResolvedValue({ active: false, currency: 'CNY' })
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    try {
      await renderApp(<CashbackActivityPage />, client)
      expect(
        await screen.findByText(/12\.5% of the top-up face amount/)
      ).toBeVisible()

      await act(async () => {
        vi.advanceTimersByTime(30_000)
      })
      expect(
        await screen.findByText('No active cashback offers right now.')
      ).toBeVisible()
        expect(
        screen.queryByText(/12\.5% of the top-up face amount/)
      ).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('refreshes a mounted page on focus even when the app disables focus refetch by default', async () => {
    client.setDefaultOptions({
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    })
    getPublicCashbackOffers
      .mockResolvedValueOnce({
        active: true,
        currency: 'CNY',
        invitee: { strategy: 'rate', rate_bps: 1250 },
      })
      .mockResolvedValue({ active: false, currency: 'CNY' })
    await renderApp(<CashbackActivityPage />, client)
    expect(
      await screen.findByText(/12\.5% of the top-up face amount/)
    ).toBeVisible()

    try {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
      expect(
        await screen.findByText('No active cashback offers right now.')
      ).toBeVisible()
    } finally {
      focusManager.setFocused(undefined)
    }
  })

  it('hides cached active rules while a focus refresh is still unresolved', async () => {
    getPublicCashbackOffers
      .mockResolvedValueOnce({
        active: true,
        currency: 'CNY',
        invitee: { strategy: 'rate', rate_bps: 1250 },
      })
      .mockReturnValue(new Promise(() => {}))
    await renderApp(<CashbackActivityPage />, client)
    expect(
      await screen.findByText(/12\.5% of the top-up face amount/)
    ).toBeVisible()

    try {
      act(() => {
        focusManager.setFocused(false)
        focusManager.setFocused(true)
      })
      await waitFor(() =>
        expect(getPublicCashbackOffers).toHaveBeenCalledTimes(2)
      )
      expect(screen.getByText('Checking current offers…')).toBeVisible()
      expect(
        screen.getAllByText('Rule unavailable; check again later.')
      ).toHaveLength(2)
      expect(
        screen.queryByText('Current cashback rules')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText(/12\.5% of the top-up face amount/)
      ).not.toBeInTheDocument()
    } finally {
      focusManager.setFocused(undefined)
    }
  })

  it('does not display cached active rules during an unresolved remount fetch', async () => {
    client.setQueryData(['cashback', 'public-offers'], {
      active: true,
      currency: 'CNY',
      invitee: { strategy: 'rate', rate_bps: 1250 },
    })
    getPublicCashbackOffers.mockReturnValue(new Promise(() => {}))
    await renderApp(<CashbackActivityPage />, client)
    await waitFor(() =>
      expect(getPublicCashbackOffers).toHaveBeenCalledTimes(1)
    )
    expect(screen.getByText('Checking current offers…')).toBeVisible()
    expect(screen.queryByText('Current cashback rules')).not.toBeInTheDocument()
    expect(
      screen.queryByText(/12\.5% of the top-up face amount/)
    ).not.toBeInTheDocument()
  })

  it('hides formerly active rules if a scheduled refresh fails', async () => {
    getPublicCashbackOffers
      .mockResolvedValueOnce({
        active: true,
        currency: 'CNY',
        invitee: { strategy: 'rate', rate_bps: 1250 },
      })
      .mockRejectedValue(new Error('unavailable'))
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    try {
      await renderApp(<CashbackActivityPage />, client)
      expect(
        await screen.findByText(/12\.5% of the top-up face amount/)
      ).toBeVisible()

      await act(async () => {
        vi.advanceTimersByTime(30_000)
      })
      expect(
        await screen.findByText('Current offers are temporarily unavailable.')
      ).toBeVisible()
      expect(
        screen.queryByText(/12\.5% of the top-up face amount/)
      ).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows the active rate and per-hundred rules without internal limits', async () => {
    getPublicCashbackOffers.mockResolvedValue({
      active: true,
      currency: 'CNY',
      inviter: { strategy: 'rate', rate_bps: 1250 },
      invitee: { strategy: 'per_hundred', fixed_per_hundred: 5 },
    })
    await renderApp(<CashbackActivityPage />, client)
    expect(
      await screen.findByText(/12\.5% of the top-up face amount/)
    ).toBeVisible()
    expect(screen.getByText(/¥5\.00 back for every CNY 100/)).toBeVisible()
    expect(screen.queryByText(/24-hour reward limit/)).not.toBeInTheDocument()
  })

  it('shows read failure instead of presenting stale rules as a live offer', async () => {
    getPublicCashbackOffers.mockRejectedValue(new Error('unavailable'))
    await renderApp(<CashbackActivityPage />, client)
    expect(
      await screen.findByText('Current offers are temporarily unavailable.')
    ).toBeVisible()
    expect(screen.queryByText('Current cashback rules')).not.toBeInTheDocument()
  })

  it('sends signed-in users to the wallet for their own offer and referral link', async () => {
    useAuthStore.getState().auth.setBundle(createTestAuthBundle())
    await renderApp(<CashbackActivityPage />, client)

    expect(screen.getByRole('link', { name: 'Wallet' })).toHaveAttribute(
      'href',
      '/wallet'
    )
    expect(
      screen.getByRole('link', { name: 'Your Referral Link' })
    ).toHaveAttribute('href', '/wallet')
  })
})
