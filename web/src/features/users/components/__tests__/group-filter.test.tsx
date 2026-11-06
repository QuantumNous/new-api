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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { Route as UsersRoute } from '@/routes/_authenticated/users/index'
import { useAuthStore } from '@/stores/auth-store'

import { UsersProvider } from '../users-provider'
import { UsersTable } from '../users-table'

const clients: QueryClient[] = []
const premiumSearchUrl =
  '/api/user/search?keyword=&group=premium&p=1&page_size=20'

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  localStorage.clear()
  useAuthStore.getState().auth.setUser({ id: 1, username: 'admin', role: 100 })
})

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear())
  localStorage.clear()
  useAuthStore.getState().auth.reset()
})

async function renderUsers(initialEntry = '/users/') {
  const get = vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/group/') {
      return { data: { success: true, data: ['default', 'premium'] } }
    }
    return {
      data: {
        success: true,
        data: {
          items: [
            {
              id: 2,
              username: 'premium-user',
              display_name: '',
              role: 1,
              status: 1,
              quota: 0,
              used_quota: 0,
              request_count: 0,
              group: 'premium',
            },
          ],
          total: 1,
        },
      },
    }
  })
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const users = createRoute({
    getParentRoute: () => auth,
    path: 'users/',
    validateSearch: UsersRoute.options.validateSearch,
    component: () => (
      <TooltipProvider>
        <UsersProvider>
          <UsersTable />
        </UsersProvider>
      </TooltipProvider>
    ),
  })
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([users])]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
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
  await screen.findByText('premium-user')
  return { get, router }
}

// The User Group column header is a sort menu with the same name; the
// filter chip is the one that opens a dialog.
function getGroupFilterTrigger() {
  const trigger = screen
    .getAllByRole('button', { name: /^User Group/ })
    .find((button) => button.getAttribute('aria-haspopup') === 'dialog')
  expect(trigger).toBeDefined()
  return trigger as HTMLElement
}

it('searches only the selected user group and lists all users again after the filter is cleared', async () => {
  const user = userEvent.setup()
  const { get, router } = await renderUsers()
  expect(get).toHaveBeenCalledWith('/api/user/', {
    params: { p: 1, page_size: 20 },
  })

  await user.click(getGroupFilterTrigger())
  await user.click(await screen.findByRole('option', { name: /^premium/ }))

  await waitFor(() => expect(get).toHaveBeenLastCalledWith(premiumSearchUrl))
  expect(router.state.location.search).toMatchObject({ group: ['premium'] })
  expect(getGroupFilterTrigger()).toHaveTextContent('premium')

  await user.click(screen.getByRole('option', { name: 'Clear filters' }))

  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith('/api/user/', {
      params: { p: 1, page_size: 20 },
    })
  )
  expect(router.state.location.search).not.toHaveProperty('group')
})

it('restores the user group filter from the page URL on load', async () => {
  const { get } = await renderUsers('/users/?group=%5B%22premium%22%5D')

  expect(get).toHaveBeenCalledWith(premiumSearchUrl)
  expect(get).not.toHaveBeenCalledWith('/api/user/', expect.anything())
  expect(getGroupFilterTrigger()).toHaveTextContent('premium')
})
