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
import { QueryClient } from '@tanstack/react-query'
import { act, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Home } from '@/features/home'
import { useAuthStore } from '@/stores/auth-store'
import { renderApp } from '@/test-utils/render-app'

const { getHomePageContent, getPublicCashbackOffers } = vi.hoisted(() => ({
  getHomePageContent: vi.fn(),
  getPublicCashbackOffers: vi.fn(),
}))
vi.mock('@/features/home/api', () => ({ getHomePageContent }))
vi.mock('@/features/cashback/api', () => ({ getPublicCashbackOffers }))

const originalAuth = useAuthStore.getState()
let client: QueryClient

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-07T15:59:59.000Z'))
  localStorage.removeItem('home_page_content')
  useAuthStore.getState().auth.reset()
  getHomePageContent.mockReset().mockResolvedValue({ success: true, data: '' })
  getPublicCashbackOffers.mockReset().mockResolvedValue({
    active: true,
    currency: 'CNY',
    inviter: { strategy: 'rate', rate_bps: 500 },
    invitee: { strategy: 'rate', rate_bps: 1250 },
  })
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  client.setQueryData(
    ['status'],
    { HeaderNavModules: '{"pricing":{"enabled":false}}' },
    { updatedAt: Date.now() + 60_000 }
  )
})

afterEach(() => {
  client.clear()
  localStorage.removeItem('home_page_content')
  useAuthStore.setState(originalAuth)
  vi.useRealTimers()
})

describe('default home campaign deadline', () => {
  it('before Beijing midnight shows the complete live payer and inviter campaign on the home route', async () => {
    await renderApp(<Home />, client)
    expect(
      await screen.findByText(/12\.5% of the top-up face amount/)
    ).toBeVisible()
    expect(
      screen.getByText(/Current rule: 5% of the top-up face amount/)
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Top-up rewards' })
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Invite rewards' })
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute(
      'href',
      '/sign-up'
    )
  })

  it('hides cached active offers while the home campaign request fails', async () => {
    client.setQueryData(['cashback', 'public-offers'], {
      active: true,
      currency: 'CNY',
      invitee: { strategy: 'rate', rate_bps: 1250 },
    })
    getPublicCashbackOffers.mockRejectedValue(new Error('unavailable'))
    await renderApp(<Home />, client)
    expect(
      await screen.findByText('Current offers are temporarily unavailable.')
    ).toBeVisible()
    expect(
      screen.getAllByText('Rule unavailable; check again later.')
    ).toHaveLength(2)
    expect(
      screen.queryByText(/12\.5% of the top-up face amount/)
    ).not.toBeInTheDocument()
  })

  it('at Beijing midnight loads the original product home instead of requesting offers', async () => {
    vi.setSystemTime(new Date('2026-10-07T16:00:00.000Z'))
    await renderApp(<Home />, client)
    expect(
      await screen.findByRole('heading', {
        name: 'Change two values. Access every leading provider.',
      })
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Models' })).toHaveAttribute(
      'href',
      '/#models'
    )
    expect(getPublicCashbackOffers).not.toHaveBeenCalled()
  })

  it('restores product home on deadline without a reload and rechecks after focus', async () => {
    vi.useRealTimers()
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date('2026-10-07T15:59:59.000Z'))
    await renderApp(<Home />, client)
    await act(async () => {
      await Promise.resolve()
    })
    expect(
      screen.getByRole('heading', { name: 'Top-up and inviter cashback' })
    ).toBeVisible()
    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })
    expect(
      screen.getByRole('heading', {
        name: 'Change two values. Access every leading provider.',
      })
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Top-up and inviter cashback' })
    ).not.toBeInTheDocument()
  })

  it.each([
    ['<h1>Admin HTML</h1>', 'Admin HTML'],
    ['# Admin Markdown', 'Admin Markdown'],
    ['https://example.com/home', 'Custom Home Page'],
  ])(
    'keeps administrator content %s ahead of the campaign before and after midnight',
    async (content, label) => {
      getHomePageContent.mockResolvedValue({ success: true, data: content })
      await renderApp(<Home />, client)
      if (content.startsWith('<')) {
        await waitFor(() =>
          expect(
            document.querySelector('.custom-home-content')?.shadowRoot
              ?.textContent
          ).toContain(label)
        )
      } else if (content.startsWith('https://')) {
        expect(await screen.findByTitle(label)).toHaveAttribute('src', content)
      } else {
        expect(
          await screen.findByRole('heading', { name: label })
        ).toBeVisible()
      }
      expect(
        screen.queryByRole('heading', { name: 'Top-up and inviter cashback' })
      ).not.toBeInTheDocument()
      vi.setSystemTime(new Date('2026-10-07T16:00:00.000Z'))
      act(() => {
        window.dispatchEvent(new Event('focus'))
      })
      if (content.startsWith('<')) {
        expect(
          document.querySelector('.custom-home-content')?.shadowRoot
            ?.textContent
        ).toContain(label)
      } else if (content.startsWith('https://')) {
        expect(screen.getByTitle(label)).toHaveAttribute('src', content)
      } else {
        expect(screen.getByRole('heading', { name: label })).toBeVisible()
      }
      expect(getPublicCashbackOffers).not.toHaveBeenCalled()
    }
  )

  it('rechecks an overdue campaign on window focus after a suspended tab resumes', async () => {
    await renderApp(<Home />, client)
    expect(
      await screen.findByRole('heading', {
        name: 'Top-up and inviter cashback',
      })
    ).toBeVisible()
    vi.setSystemTime(new Date('2026-10-07T16:00:01.000Z'))
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() =>
      expect(
        screen.getByRole('heading', {
          name: 'Change two values. Access every leading provider.',
        })
      ).toBeVisible()
    )
  })
})
