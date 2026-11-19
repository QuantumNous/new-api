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
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { UsersProvider } from '../users-provider'
import { UsersTable } from '../users-table'

const clients: QueryClient[] = []

function UsersPage() {
  return (
    <TooltipProvider>
      <UsersProvider>
        <UsersTable />
      </UsersProvider>
    </TooltipProvider>
  )
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  useAuthStore.getState().auth.setUser({ id: 1, username: 'admin', role: 100 })
})

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear())
  useAuthStore.getState().auth.reset()
  vi.restoreAllMocks()
})

it('renders account management fields without gateway business columns or group requests', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: {
        items: [
          {
            id: 2,
            username: 'standard-user',
            display_name: 'Standard User',
            role: 1,
            status: 1,
            created_at: 1795000000,
            last_login_at: 1795000100,
            quota: 1000,
            used_quota: 500,
            request_count: 20,
            group: 'legacy-group',
            aff_count: 3,
            aff_history_quota: 100,
            inviter_id: 1,
          },
        ],
        total: 1,
      },
    },
  })

  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const users = createRoute({
    getParentRoute: () => auth,
    path: 'users/',
    component: UsersPage,
  })
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([users])]),
    history: createMemoryHistory({ initialEntries: ['/users/'] }),
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)

  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )

  expect(await screen.findByText('standard-user')).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Username' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Role' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Time' })).toBeInTheDocument()

  expect(screen.queryByRole('columnheader', { name: /Available Balance/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: 'Invite Info' })).not.toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: 'User Group' })).not.toBeInTheDocument()
  expect(get).toHaveBeenCalledWith('/api/user/', {
    params: { p: 1, page_size: 20 },
  })
  expect(get).not.toHaveBeenCalledWith('/api/group/')
})
