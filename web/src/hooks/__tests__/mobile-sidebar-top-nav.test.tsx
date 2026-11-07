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
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { useSidebarView } from '../use-sidebar-view'

const viewport = vi.hoisted(() => ({ compact: true }))

vi.mock('@/hooks/use-media-query', () => ({
  useMediaQuery: () => viewport.compact,
}))

vi.mock('@/hooks/use-top-nav-links', () => ({
  useTopNavLinks: () => [
    { title: 'Home', href: '/' },
    { title: 'Docs', href: 'https://docs.example.com', external: true },
  ],
}))

function SidebarProbe() {
  const { navGroups } = useSidebarView()
  const general = navGroups.find((group) => group.id === 'general')
  const apiKeysIndex =
    general?.items.findIndex((item) => item.url === '/keys') ?? -1
  const headerItems =
    general?.items
      .slice(apiKeysIndex + 1)
      .filter((item) => item.title === 'Home' || item.title === 'Docs') ?? []

  return (
    <div>
      <span data-testid='titles'>
        {general?.items.map((item) => item.title).join('|')}
      </span>
      <span data-testid='links'>
        {headerItems
          .map(
            (item) => `${item.title}:${item.external ? 'external' : 'internal'}`
          )
          .join('|')}
      </span>
    </div>
  )
}

async function renderProbe() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], { SidebarModulesAdmin: '' })
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'alice',
    role: ROLE.ADMIN,
    permissions: { sidebar_settings: true },
    sidebar_modules: '',
  })

  const router = createRouter({
    routeTree: createRootRoute({ component: SidebarProbe }),
    history: createMemoryHistory({ initialEntries: ['/dashboard/overview'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

afterEach(() => {
  cleanup()
  useAuthStore.getState().auth.reset()
  viewport.compact = true
})

describe('mobile sidebar header navigation', () => {
  it('adds the header links directly below API Keys without a Navigation group', async () => {
    await renderProbe()

    const titles = screen.getByTestId('titles').textContent?.split('|') ?? []
    expect(titles.slice(0, 5)).toEqual([
      'Overview',
      'Dashboard',
      'API Keys',
      'Home',
      'Docs',
    ])
    expect(titles).not.toContain('Navigation')
    expect(screen.getByTestId('links')).toHaveTextContent(
      'Home:internal|Docs:external'
    )
  })

  it('keeps header links out of the sidebar on desktop', async () => {
    viewport.compact = false

    await renderProbe()

    expect(screen.getByTestId('titles')).not.toHaveTextContent('Home')
    expect(screen.getByTestId('titles')).not.toHaveTextContent('Docs')
    expect(screen.getByTestId('links')).toHaveTextContent('')
  })
})
