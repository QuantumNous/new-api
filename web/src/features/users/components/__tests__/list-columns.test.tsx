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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { Route as UsersRoute } from '@/routes/_authenticated/users/index'
import { useAuthStore } from '@/stores/auth-store'

import type { User } from '../../types'
import { UsersProvider } from '../users-provider'
import { UsersTable } from '../users-table'

const clients: QueryClient[] = []

function makeUser(
  id: number,
  username: string,
  role: number,
  payableDiscount: number | null
): User {
  return {
    id,
    username,
    display_name: '',
    email: '',
    role,
    status: 1,
    quota: 500000,
    used_quota: 0,
    request_count: 0,
    group: 'default',
    aff_code: '',
    aff_count: 2,
    aff_quota: 0,
    aff_history_quota: 500000,
    inviter_id: 0,
    remark: '',
    created_at: 1_767_225_600,
    last_login_at: 0,
    DeletedAt: null,
    payable_discount: payableDiscount,
  }
}

// Unsetting a supplier keeps the discount on the user (it prefills the
// dialog if the user becomes a supplier again), so a common user can still
// carry one.
const users = [
  makeUser(2, 'supplier-with-discount', 5, 0.85),
  makeUser(3, 'supplier-without-discount', 5, null),
  makeUser(4, 'former-supplier', 1, 0.9),
  makeUser(5, 'admin-user', 10, null),
]

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

async function renderUsers() {
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/group/') {
      return { data: { success: true, data: ['default'] } }
    }
    return {
      data: {
        success: true,
        data: { items: users, total: users.length, page: 1, page_size: 20 },
      },
    }
  })
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const usersRoute = createRoute({
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
    routeTree: root.addChildren([auth.addChildren([usersRoute])]),
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
  await screen.findByText('supplier-with-discount')
}

function getUserRow(username: string) {
  return screen.getByRole('row', { name: new RegExp(`\\b${username}\\b`) })
}

function getPayableDiscountCell(username: string) {
  const column = screen
    .getAllByRole('columnheader')
    .indexOf(screen.getByRole('columnheader', { name: 'Payable Discount' }))
  return within(getUserRow(username)).getAllByRole('cell')[column]
}

it('shows the payable discount column and hides balance, group and invite columns by default', async () => {
  await renderUsers()

  expect(
    screen.getByRole('columnheader', { name: 'Payable Discount' })
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('columnheader', { name: /^Available Balance/ })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('columnheader', { name: /^User Group/ })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('columnheader', { name: 'Invite Info' })
  ).not.toBeInTheDocument()
})

it.each([
  {
    who: 'a supplier with a discount',
    username: 'supplier-with-discount',
    expected: '0.85',
  },
  {
    who: 'a supplier without a discount',
    username: 'supplier-without-discount',
    expected: 'Not set',
  },
  {
    who: 'a common user who keeps a former supplier discount',
    username: 'former-supplier',
    expected: '—',
  },
  { who: 'an administrator', username: 'admin-user', expected: '—' },
])(
  'shows "$expected" in the payable discount column for $who',
  async ({ username, expected }) => {
    await renderUsers()

    expect(getPayableDiscountCell(username).textContent).toBe(expected)
  }
)

it('shows a supplier discount once per row instead of repeating it under the role', async () => {
  await renderUsers()

  expect(
    within(getUserRow('supplier-with-discount')).getAllByText(/0\.85/)
  ).toHaveLength(1)
})

it('lists the hidden columns unchecked in the View menu and shows one again when it is checked', async () => {
  const user = userEvent.setup()
  await renderUsers()

  await user.click(screen.getByRole('button', { name: 'View' }))
  expect(
    screen.getByRole('menuitemcheckbox', { name: /^Available Balance/ })
  ).not.toBeChecked()
  expect(
    screen.getByRole('menuitemcheckbox', { name: 'User Group' })
  ).not.toBeChecked()
  expect(
    screen.getByRole('menuitemcheckbox', { name: 'Invite Info' })
  ).not.toBeChecked()

  await user.click(
    screen.getByRole('menuitemcheckbox', { name: 'Invite Info' })
  )

  expect(
    screen.getByRole('columnheader', { name: 'Invite Info' })
  ).toBeInTheDocument()
})
