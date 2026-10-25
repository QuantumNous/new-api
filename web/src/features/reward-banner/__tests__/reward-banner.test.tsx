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
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter } from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { CashbackPublicOffers } from '@/features/cashback/types'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { createTestAuthBundle } from '@/test-utils/auth-bundle'

import { REWARD_BANNER_DISMISS_KEY, RewardBanner } from '..'

const originalAdapter = api.defaults.adapter
let client: QueryClient

const firstTopUpOffers: CashbackPublicOffers = {
  active: true,
  currency: 'CNY',
  invitee: {
    strategy: 'tiered',
    tiers: [{ threshold_cents: 10_000, reward_cents: 500 }],
    payer_scope: 'first_top_up',
  },
}

function serveOffers(respond: () => { status: number; data: unknown }) {
  const adapter: AxiosAdapter = async (config) => {
    const reply = respond()
    return { config, statusText: 'OK', headers: {}, ...reply }
  }
  api.defaults.adapter = adapter
}

function offersReply(offers: CashbackPublicOffers) {
  return { status: 200, data: { success: true, data: offers } }
}

async function renderAt(path: string, status: Record<string, unknown> = {}) {
  client.setQueryData(
    ['status'],
    { register_enabled: true, quota_for_new_user: 0, ...status },
    { updatedAt: Date.now() + 60_000 }
  )
  const root = createRootRoute({
    component: () => (
      <QueryClientProvider client={client}>
        <RewardBanner />
        <Outlet />
      </QueryClientProvider>
    ),
  })
  const routeTree = root.addChildren(
    ['/', '/setup', '/oauth/$provider', '/404', '/wallet', '/sign-up'].map(
      (routePath) =>
        createRoute({
          getParentRoute: () => root,
          path: routePath,
          component: () => <main>page</main>,
        })
    )
  )
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await act(async () => {
    await router.load()
  })
  return render(<RouterProvider router={router} />)
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  window.localStorage.removeItem(REWARD_BANNER_DISMISS_KEY)
})

afterEach(() => {
  cleanup()
  client.clear()
  api.defaults.adapter = originalAdapter
  useAuthStore.getState().auth.reset()
  window.localStorage.removeItem(REWARD_BANNER_DISMISS_KEY)
  document.documentElement.style.removeProperty('--reward-banner-height')
})

describe('RewardBanner', () => {
  it('sends anonymous visitors to sign-up from a live first-top-up offer', async () => {
    serveOffers(() => offersReply(firstTopUpOffers))
    await renderAt('/')

    const banner = await screen.findByRole('region', {
      name: 'Current rewards',
    })
    expect(banner).toHaveTextContent('First top-up ¥100 get ¥5')
    expect(screen.getByRole('link', { name: /Top up now/ })).toHaveAttribute(
      'href',
      '/sign-up'
    )
  })

  it('sends signed-in users to the wallet', async () => {
    useAuthStore.getState().auth.setBundle(createTestAuthBundle())
    serveOffers(() => offersReply(firstTopUpOffers))
    await renderAt('/')

    expect(
      await screen.findByRole('link', { name: /Top up now/ })
    ).toHaveAttribute('href', '/wallet')
  })

  it('stays hidden when the offers request fails even with a sign-up grant', async () => {
    serveOffers(() => ({ status: 500, data: { success: false } }))
    await renderAt('/', { quota_for_new_user: 500_000 })

    await waitFor(() =>
      expect(client.getQueryState(['cashback', 'public-offers'])?.status).toBe(
        'error'
      )
    )
    expect(screen.queryByRole('region', { name: 'Current rewards' })).toBeNull()
  })

  it('shows only the sign-up grant when no campaign is live', async () => {
    serveOffers(() => offersReply({ active: false, currency: 'CNY' }))
    await renderAt('/', { quota_for_new_user: 500_000 })

    const banner = await screen.findByRole('region', {
      name: 'Current rewards',
    })
    expect(banner).toHaveTextContent(/New users get .+ on sign-up/)
    expect(banner).not.toHaveTextContent('Top up ¥')
  })

  it.each(['/setup', '/oauth/github', '/404', '/missing-page'])(
    'is hidden on %s',
    async (path) => {
      serveOffers(() => offersReply(firstTopUpOffers))
      await renderAt(path)

      await waitFor(() =>
        expect(
          client.getQueryState(['cashback', 'public-offers'])?.status
        ).toBe('success')
      )
      expect(
        screen.queryByRole('region', { name: 'Current rewards' })
      ).toBeNull()
    }
  )

  it('stays dismissed for the same rules and returns when the rules change', async () => {
    let offers = firstTopUpOffers
    serveOffers(() => offersReply(offers))
    const view = await renderAt('/')

    await userEvent.click(
      await screen.findByRole('button', { name: 'Dismiss reward banner' })
    )
    expect(screen.queryByRole('region', { name: 'Current rewards' })).toBeNull()

    view.unmount()
    client.clear()
    await renderAt('/')
    await waitFor(() =>
      expect(client.getQueryState(['cashback', 'public-offers'])?.status).toBe(
        'success'
      )
    )
    expect(screen.queryByRole('region', { name: 'Current rewards' })).toBeNull()

    offers = {
      ...firstTopUpOffers,
      invitee: { strategy: 'rate', rate_bps: 500 },
    }
    await act(async () => {
      await client.refetchQueries({ queryKey: ['cashback', 'public-offers'] })
    })
    expect(
      await screen.findByRole('region', { name: 'Current rewards' })
    ).toHaveTextContent('Top-up: 5% back')
  })
})
