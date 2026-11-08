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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ClipboardList,
  FileText,
  Key,
  LayoutDashboard,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'

import type { NavGroup } from '@/shared/components/layout/types'
import { SearchProvider } from '@/shared/context/search-provider'
import { ROLE } from '@/shared/lib/roles'
import { STATUS_QUERY_KEY } from '@/shared/lib/status-query'
import { useAuthStore } from '@/shared/stores/auth-store'

import { CommandMenu } from '../command-menu'
import { Search } from '../search'

const clientNavGroups: NavGroup[] = [
  {
    id: 'workspace',
    title: 'Workspace',
    items: [
      {
        title: 'Workspace',
        url: '/app/workspace/overview',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: 'api-usage',
    title: 'API & Usage',
    items: [
      { title: 'API Keys', url: '/app/keys', icon: Key },
      { title: 'Usage Logs', url: '/app/usage-logs/common', icon: FileText },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    items: [
      { title: 'Wallet', url: '/app/wallet', icon: Wallet },
      { title: 'Profile', url: '/app/profile', icon: User },
    ],
  },
]

const adminNavGroups: NavGroup[] = [
  {
    id: 'admin-console',
    title: 'Control Panel',
    items: [
      {
        title: 'Users',
        url: '/admin/users',
        icon: Users,
        requiredRole: ROLE.ADMIN,
      },
    ],
  },
  {
    id: 'admin-security',
    title: 'Security & Limits',
    items: [
      { title: 'Audit Logs', url: '/admin/audit-logs', icon: ClipboardList },
    ],
  },
]

// jsdom lacks the Web Animations API the menu's scroll area waits on.
const getAnimationsDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'getAnimations'
)

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
    configurable: true,
    value: () => [],
  })
})

afterAll(() => {
  if (getAnimationsDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      'getAnimations',
      getAnimationsDescriptor
    )
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations')
  }
})

afterEach(() => {
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  window.localStorage.clear()
})

function CommandMenuHarness(props: { navGroups: NavGroup[] }) {
  return (
    <SearchProvider>
      <Search />
      <CommandMenu navGroups={props.navGroups} />
    </SearchProvider>
  )
}

async function searchEntriesFor(
  role: number,
  navGroups: NavGroup[],
  sidebarModulesAdmin = ''
) {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'alice', role })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(STATUS_QUERY_KEY, {
    SidebarModulesAdmin: sidebarModulesAdmin,
  })
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => <CommandMenuHarness navGroups={navGroups} />,
    }),
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

  await userEvent.click(await screen.findByRole('button', { name: 'Search' }))
  const options = await screen.findAllByRole('option')
  return options.map((option) => option.textContent)
}

test('the client menu lists the client pages only', async () => {
  const entries = await searchEntriesFor(ROLE.USER, clientNavGroups)

  expect(entries).toEqual(
    expect.arrayContaining(['API Keys', 'Usage Logs', 'Wallet', 'Profile'])
  )
  expect(entries).not.toContain('Users')
  expect(entries).not.toContain('Audit Logs')
})

test('the admin menu lists the admin pages only', async () => {
  const entries = await searchEntriesFor(ROLE.ADMIN, adminNavGroups)

  expect(entries).toEqual(expect.arrayContaining(['Users', 'Audit Logs']))
  expect(entries).not.toContain('Wallet')
  expect(entries).not.toContain('API Keys')
})

test('pages hidden in the sidebar settings stay out of search', async () => {
  const entries = await searchEntriesFor(
    ROLE.USER,
    clientNavGroups,
    JSON.stringify({ personal: { enabled: true, topup: false } })
  )

  expect(entries).not.toContain('Wallet')
  expect(entries).toContain('Profile')
})
