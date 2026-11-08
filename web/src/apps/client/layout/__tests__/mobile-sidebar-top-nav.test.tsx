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
import { FileText, Key } from 'lucide-react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { NavGroup } from '@/shared/components/layout/types'
import { ROLE } from '@/shared/lib/roles'
import { useAuthStore } from '@/shared/stores/auth-store'

import { useSidebarView } from '@/shared/hooks/use-sidebar-view'

const viewport = vi.hoisted(() => ({ compact: true }))

vi.mock('@/shared/hooks/use-media-query', () => ({
  useMediaQuery: () => viewport.compact,
}))

vi.mock('@/shared/hooks/use-top-nav-links', () => ({
  useTopNavLinks: () => [
    { title: 'Home', href: '/' },
    { title: 'Docs', href: 'https://docs.example.com', external: true },
  ],
}))

const clientNavGroups: NavGroup[] = [
  {
    id: 'api-usage',
    title: 'API & Usage',
    items: [
      { title: 'API Keys', url: '/app/keys', icon: Key },
      { title: 'Usage Logs', url: '/app/usage-logs/common', icon: FileText },
    ],
  },
]

function SidebarProbe() {
  const { navGroups } = useSidebarView(clientNavGroups, {
    includeTopNavLinks: true,
  })
  const apiGroup = navGroups.find((group) =>
    group.items.some((item) => item.url === '/app/keys')
  )
  const apiKeysIndex =
    apiGroup?.items.findIndex((item) => item.url === '/app/keys') ?? -1
  const headerItems =
    apiGroup?.items
      .slice(apiKeysIndex + 1)
      .filter((item) => item.title === 'Home' || item.title === 'Docs') ?? []

  return (
    <div>
      <span data-testid='titles'>
        {apiGroup?.items.map((item) => item.title).join('|')}
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
    role: ROLE.USER,
    permissions: { sidebar_settings: true },
    sidebar_modules: '',
  })

  const router = createRouter({
    routeTree: createRootRoute({ component: SidebarProbe }),
    history: createMemoryHistory({
      initialEntries: ['/app/workspace/overview'],
    }),
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
    expect(titles).toEqual(['API Keys', 'Home', 'Docs', 'Usage Logs'])
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
