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
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from '@tanstack/react-router'
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { DirectionProvider } from '@/context/direction-provider'
import { FontProvider } from '@/context/font-provider'
import { ThemeProvider } from '@/context/theme-provider'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { useConsoleModeStore } from '@/stores/console-mode-store'
import { createTestAuthBundle } from '@/test-utils/auth-bundle'

import { Rankings } from '../index'

// Browser canvas boundary only; the page, query, response parser and sections
// remain real. Rendering the charts themselves is verified in the browser.
vi.mock('@visactor/react-vchart', () => ({ VChart: () => null }))
vi.mock('@visactor/vchart', () => ({
  ThemeManager: { setCurrentTheme: vi.fn() },
}))

const originalAdapter = api.defaults.adapter
const originalAuth = useAuthStore.getState()
const originalMode = useConsoleModeStore.getState().mode
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: Infinity } },
})
afterEach(() => {
  cleanup()
  client.clear()
  api.defaults.adapter = originalAdapter
  useAuthStore.setState(originalAuth)
  useConsoleModeStore.getState().setMode(originalMode)
  vi.restoreAllMocks()
})

it.each(['anonymous', 'developer', 'easy'] as const)(
  'keeps %s navigation while recovering from malformed rankings data',
  async (mode) => {
    useAuthStore.getState().auth.reset()
    if (mode !== 'anonymous') {
      useAuthStore.getState().auth.setBundle(createTestAuthBundle())
      useConsoleModeStore.getState().setMode(mode)
    }
    const user = userEvent.setup()
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    let payload: unknown = []
    client.setQueryData(['status'], { docs_link: 'https://docs.example.com' })
    api.defaults.adapter = async (config) => {
      const path = new URL(config.url ?? '', 'http://localhost').pathname
      let data: unknown
      if (path === '/api/rankings') data = payload
      else if (path === '/api/notice') data = ''
      else if (path === '/api/user/self') data = createTestAuthBundle().user
      else throw new Error(`Unexpected request: ${path}`)
      return {
        config,
        data: { success: true, data },
        headers: {},
        status: 200,
        statusText: 'OK',
      }
    }
    const root = createRootRoute({
      errorComponent: () => <p>Unexpected route failure</p>,
    })
    const route = createRoute({
      getParentRoute: () => root,
      path: 'rankings/',
      component: Rankings,
    })
    const router = createRouter({
      routeTree: root.addChildren([route]),
      history: createMemoryHistory({ initialEntries: ['/rankings'] }),
    })
    await act(() => router.load())
    render(
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <FontProvider>
            <DirectionProvider>
              <RouterProvider router={router} />
            </DirectionProvider>
          </FontProvider>
        </ThemeProvider>
      </QueryClientProvider>
    )

    expect(
      await screen.findByRole('heading', { name: 'Unable to load rankings' })
    ).toBeVisible()
    expect(
      screen.queryByText('Unexpected route failure')
    ).not.toBeInTheDocument()
    if (mode === 'developer') {
      const navigation = screen.getByRole('navigation', {
        name: 'Main navigation',
      })
      expect(
        within(navigation)
          .getAllByRole('link')
          .map((link) => link.textContent)
      ).toEqual([
        'Home',
        'Overview',
        'Model Square',
        'Rankings',
        'Docs',
        'About',
      ])
      expect(
        within(navigation).getByRole('link', { name: 'Docs' })
      ).toHaveAttribute('href', 'https://docs.example.com')
      expect(
        within(navigation).getByRole('link', { name: 'Rankings' })
      ).toHaveAttribute('href', '/rankings')
    } else if (mode === 'easy') {
      expect(
        screen.getByRole('button', { name: 'Developer mode' })
      ).toBeVisible()
      expect(screen.getByRole('link', { name: 'Requests' })).toHaveAttribute(
        'href',
        '/usage-logs/common'
      )
    } else {
      expect(
        screen.queryByRole('link', { name: 'Beginner guide' })
      ).not.toBeInTheDocument()
      expect(
        screen
          .getAllByRole('link', { name: 'Model Price' })
          .every((link) => link.getAttribute('href') === '/pricing')
      ).toBe(true)
    }
    payload = {
      models: [],
      vendors: [],
      top_movers: [],
      top_droppers: [],
      models_history: { points: [], models: [], buckets: 0 },
      vendor_share_history: { points: [], vendors: [], buckets: 0 },
    }
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Top Models' })).toBeVisible()
    )
    expect(
      screen.queryByRole('heading', { name: 'Unable to load rankings' })
    ).not.toBeInTheDocument()
  }
)
