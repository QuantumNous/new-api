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
  RouterProvider,
} from '@tanstack/react-router'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/context/theme-provider'
import zhCN from '@/i18n/locales/zh.json'
import { useAuthStore } from '@/stores/auth-store'
import { createTestAuthBundle } from '@/test-utils/auth-bundle'

import { TerminalLayout } from '../terminal-layout'

let client: QueryClient
const originalAuth = useAuthStore.getState()

beforeEach(() => {
  window.localStorage.clear()
  useAuthStore.getState().auth.reset()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  i18next.addResourceBundle('zhCN', 'translation', zhCN.translation, true, true)
})

afterEach(() => {
  useAuthStore.setState(originalAuth)
  client.clear()
  window.localStorage.clear()
  vi.restoreAllMocks()
  void i18next.changeLanguage('en')
})

async function renderLayout(defaultTheme: 'dark' | 'light' = 'light') {
  const root = createRootRoute({
    component: () => (
      <TerminalLayout>
        <input aria-label='Page draft' defaultValue='Keep this draft' />
      </TerminalLayout>
    ),
  })
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(
    <ThemeProvider defaultTheme={defaultTheme}>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  )
  await screen.findByRole('textbox', { name: 'Page draft' })
}

describe('terminal sidebar transitions', () => {
  it('returns a signed-in user to the public home when the brand is clicked', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().auth.setBundle(createTestAuthBundle())
    client.setQueryData(['status'], {})
    const root = createRootRoute()
    const home = createRoute({
      getParentRoute: () => root,
      path: '/',
      component: () => <h1>Public home</h1>,
    })
    const consolePage = createRoute({
      getParentRoute: () => root,
      path: '/dashboard/overview',
      component: () => (
        <TerminalLayout>
          <h1>Console overview</h1>
        </TerminalLayout>
      ),
    })
    const router = createRouter({
      routeTree: root.addChildren([home, consolePage]),
      history: createMemoryHistory({ initialEntries: ['/dashboard/overview'] }),
    })
    await act(() => router.load())
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )
    await user.click(await screen.findByRole('link', { name: '野菜' }))
    expect(
      await screen.findByRole('heading', { name: 'Public home' })
    ).toBeVisible()
    expect(router.state.location.pathname).toBe('/')
  })

  it('keeps the beginner guide available in the easy sidebar', async () => {
    await renderLayout()

    expect(
      screen.getByRole('link', { name: 'Beginner guide' })
    ).toHaveAttribute('href', '/beginner-guide')
    expect(screen.getByRole('link', { name: 'API keys' })).toBeVisible()
  })

  it('keeps one community entry in the terminal top bar', async () => {
    await renderLayout()

    const topbar = screen.getByRole('banner')
    expect(
      within(topbar).getByRole('button', { name: 'Community' })
    ).toBeVisible()
    expect(
      within(topbar).getAllByRole('button', { name: 'Community' })
    ).toHaveLength(1)
  })

  it('keeps search input and page state while collapsing and reopening', async () => {
    const user = userEvent.setup()
    await renderLayout()
    const trigger = within(screen.getByRole('banner')).getByRole('button', {
      name: 'Collapse sidebar',
    })
    const search = screen.getByRole('textbox', { name: 'Search' })
    const draft = screen.getByRole('textbox', { name: 'Page draft' })
    await user.type(search, 'keys')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(search).toBeInTheDocument()
    expect(search).toBeDisabled()
    expect(draft).toHaveValue('Keep this draft')
    expect(screen.getByRole('link', { name: 'API keys' })).toHaveAttribute(
      'href',
      '/keys'
    )

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('textbox', { name: 'Search' })).toBe(search)
    expect(search).toHaveValue('keys')
    expect(search).toBeEnabled()
  })

  it('hides destinations disabled by site and user navigation settings', async () => {
    useAuthStore.getState().auth.setBundle({
      ...createTestAuthBundle(),
      user: {
        ...createTestAuthBundle().user,
        sidebar_modules: JSON.stringify({
          console: { enabled: true, token: false, log: false },
        }),
      },
    })
    client.setQueryData(
      ['status'],
      {
        HeaderNavModules: JSON.stringify({ pricing: false }),
        SidebarModulesAdmin: JSON.stringify({
          personal: { enabled: true, topup: false },
        }),
      },
      { updatedAt: Date.now() + 60000 }
    )

    await renderLayout()

    expect(screen.queryByRole('link', { name: 'API keys' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Models' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Wallet' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Requests' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Reports' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Playground' })).toBeVisible()
  })

  it('honors the last toggle during repeated clicks and keeps focus on the trigger', async () => {
    await renderLayout()
    const trigger = within(screen.getByRole('banner')).getByRole('button', {
      name: 'Collapse sidebar',
    })
    trigger.focus()
    fireEvent.click(trigger)
    fireEvent.click(trigger)
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
    expect(window.localStorage.getItem('ci_sidebar_collapsed')).toBe('true')
  })

  it('keeps the closed mobile drawer mounted but inert, then restores its controls on open', async () => {
    const original = window.matchMedia
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      ...original(query),
      matches: query === '(max-width: 900px)',
    }))
    await renderLayout()
    const sidebar = screen.getByRole('complementary', { hidden: true })
    const trigger = screen.getByRole('button', { name: 'Expand sidebar' })
    expect(sidebar).toHaveAttribute('inert')
    expect(trigger).toHaveAttribute('aria-controls', sidebar.id)

    fireEvent.click(trigger)
    expect(sidebar).not.toHaveAttribute('inert')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(trigger)
    expect(sidebar).toHaveAttribute('inert')
    expect(window.localStorage.getItem('ci_sidebar_collapsed')).toBeNull()
  })

  it('shows the beginner guide after opening the compact sidebar', async () => {
    const original = window.matchMedia
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      ...original(query),
      matches: query === '(max-width: 900px)',
    }))
    await renderLayout()

    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))

    expect(
      screen.getByRole('link', { name: 'Beginner guide' })
    ).toHaveAttribute('href', '/beginner-guide')
  })

  it.each([
    ['light', 'Switch to dark mode', '切换深色模式'],
    ['dark', 'Switch to light mode', '切换浅色模式'],
  ] as const)(
    'localizes the %s theme button when the language changes',
    async (theme, englishName, chineseName) => {
      await i18next.changeLanguage('en')
      await renderLayout(theme)

      expect(screen.getByRole('button', { name: englishName })).toBeVisible()
      await act(async () => {
        await i18next.changeLanguage('zhCN')
      })

      await waitFor(() =>
        expect(screen.getByRole('button', { name: chineseName })).toBeVisible()
      )
    }
  )
})
