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
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Route as DashboardSectionRoute } from '@/routes/_authenticated/dashboard/$section'
import { useConsoleModeStore } from '@/stores/console-mode-store'

import { ConsoleModeControl } from '../console-mode-switcher'
import { TerminalLayout } from '../terminal-layout'

let client: QueryClient
const previousMode = useConsoleModeStore.getState().mode

beforeEach(() => {
  window.localStorage.clear()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
})
afterEach(() => {
  client.clear()
  vi.restoreAllMocks()
  useConsoleModeStore.getState().setMode(previousMode)
  window.localStorage.clear()
})

async function renderModes(path: string) {
  const root = createRootRoute({ component: Outlet })
  const dashboard = createRoute({
    getParentRoute: () => root,
    path: '/dashboard/$section',
    component: () => <ConsoleModeControl compact />,
  })
  const channels = createRoute({
    getParentRoute: () => root,
    path: '/channels',
    component: () => <ConsoleModeControl compact />,
  })
  const keys = createRoute({
    getParentRoute: () => root,
    path: '/keys',
    component: () => (
      <TerminalLayout>
        <p>Key page</p>
      </TerminalLayout>
    ),
  })
  const beginnerGuide = createRoute({
    getParentRoute: () => root,
    path: '/beginner-guide',
    component: () => <ConsoleModeControl compact />,
  })
  const guide = createRoute({
    getParentRoute: () => root,
    path: '/guide',
    component: () => <ConsoleModeControl compact />,
  })
  const router = createRouter({
    routeTree: root.addChildren([
      dashboard,
      channels,
      keys,
      beginnerGuide,
      guide,
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await act(async () => {
    await router.load()
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return router
}

async function loadDashboardSection(path: string) {
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()()
  const authenticated = createRoute({
    getParentRoute: () => root,
    id: '_authenticated',
  })
  const dashboard = createRoute({
    getParentRoute: () => authenticated,
    path: '/dashboard/$section',
    beforeLoad: (context) =>
      DashboardSectionRoute.options.beforeLoad?.({ ...context }),
    component: () => <p>Dashboard section</p>,
  })
  const router = createRouter({
    routeTree: root.addChildren([authenticated.addChildren([dashboard])]),
    context: { queryClient: client },
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  return router
}

describe('console mode navigation', () => {
  it.each(['/dashboard/models', '/dashboard/flow', '/channels'])(
    'opens the easy overview when switching from %s',
    async (path) => {
      const user = userEvent.setup()
      useConsoleModeStore.getState().setMode('developer')
      const router = await renderModes(path)
      await user.click(await screen.findByRole('button', { name: 'Easy mode' }))
      expect(router.state.location.pathname).toBe('/dashboard/overview')
      expect(
        await screen.findByRole('button', { name: 'Easy mode' })
      ).toHaveAttribute('aria-pressed', 'true')
    }
  )

  it('opens developer analytics when switching from the easy report', async () => {
    const user = userEvent.setup()
    useConsoleModeStore.getState().setMode('easy')
    const router = await renderModes('/dashboard/reports')
    await user.click(
      await screen.findByRole('button', { name: 'Developer mode' })
    )
    expect(router.state.location.pathname).toBe('/dashboard/models')
  })

  it('redirects a developer who opens the reports URL directly to analytics', async () => {
    useConsoleModeStore.getState().setMode('developer')

    const router = await loadDashboardSection('/dashboard/reports')

    expect(router.state.location.pathname).toBe('/dashboard/models')
  })

  it.each(['/dashboard/models', '/guide'])(
    'shows developer mode on operator route %s even with an easy preference',
    async (path) => {
      useConsoleModeStore.getState().setMode('easy')
      await renderModes(path)
      expect(
        await screen.findByRole('button', { name: 'Developer mode' })
      ).toHaveAttribute('aria-pressed', 'true')
    }
  )

  it('keeps the easy shell on the authenticated beginner guide', async () => {
    useConsoleModeStore.getState().setMode('easy')
    await renderModes('/beginner-guide')

    expect(
      await screen.findByRole('button', { name: 'Easy mode' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(useConsoleModeStore.getState().mode).toBe('easy')
  })

  it('keeps both mode choices in the easy header without losing the current request page', async () => {
    const user = userEvent.setup()
    useConsoleModeStore.getState().setMode('easy')
    const router = await renderModes('/keys')
    await user.click(
      await screen.findByRole('button', { name: 'Developer mode' })
    )
    expect(useConsoleModeStore.getState().mode).toBe('developer')
    expect(router.state.location.pathname).toBe('/keys')
    await user.click(screen.getByRole('button', { name: 'Easy mode' }))
    expect(router.state.location.pathname).toBe('/keys')
    expect(useConsoleModeStore.getState().mode).toBe('easy')
  })
})
