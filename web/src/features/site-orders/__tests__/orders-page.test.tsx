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
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { SiteOrders } from '../index'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
afterEach(() => vi.resetAllMocks())
async function showPage(personal = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => <SiteOrders scope={personal ? 'personal' : 'site'} />,
    }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return client
}
test('empty orders remain searchable and search sends user and order filters to server', async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: { success: true, data: { items: [], total: 0 } },
  })
  const client = await showPage()
  expect(await screen.findByText('No billing records found')).toBeVisible()
  await userEvent.type(
    screen.getByLabelText('Order or payment transaction number'),
    'WX123'
  )
  await userEvent.type(screen.getByLabelText('Username or user ID'), '42')
  expect(
    screen.queryByRole('button', { name: /^Search$/ })
  ).not.toBeInTheDocument()
  await waitFor(() =>
    expect(api.get).toHaveBeenLastCalledWith('/api/user/orders', {
      params: expect.objectContaining({
        keyword: 'WX123',
        user: '42',
        p: 1,
        page_size: 20,
      }),
    })
  )
  client.clear()
})
test('list failure displays retry instead of a misleading empty list', async () => {
  vi.mocked(api.get)
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValue({
      data: { success: true, data: { items: [], total: 0 } },
    })
  const client = await showPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))
  expect(await screen.findByText('No billing records found')).toBeVisible()
  client.clear()
})

test('choosing a payment provider filters immediately and resets the page', async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: { success: true, data: { items: [], total: 60 } },
  })
  const client = await showPage()
  await userEvent.click(
    await screen.findByRole('button', { name: 'Go to next page' })
  )
  await waitFor(() =>
    expect(api.get).toHaveBeenLastCalledWith('/api/user/orders', {
      params: expect.objectContaining({ p: 2 }),
    })
  )
  await userEvent.click(
    screen.getByRole('combobox', { name: 'Payment Method' })
  )
  await userEvent.click(await screen.findByRole('option', { name: 'Alipay' }))
  await waitFor(() =>
    expect(api.get).toHaveBeenLastCalledWith('/api/user/orders', {
      params: expect.objectContaining({ provider: 'alipay', p: 1 }),
    })
  )
  client.clear()
})

test('personal orders use the scoped endpoint and hide user filtering', async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: { success: true, data: { items: [], total: 0 } },
  })
  const client = await showPage(true)
  expect(
    await screen.findByRole('heading', { name: 'My orders' })
  ).toBeVisible()
  await waitFor(() =>
    expect(api.get).toHaveBeenCalledWith(
      '/api/user/self/orders',
      expect.anything()
    )
  )
  expect(screen.queryByLabelText('Username or user ID')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('columnheader', { name: 'User' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('columnheader', { name: 'Frozen quota' })
  ).not.toBeInTheDocument()
  client.clear()
})
