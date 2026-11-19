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
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import { createInstance, type i18n as I18n } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import type { ThirdPartySite } from '../../types'
import { ThirdPartySitesDialogs } from '../third-party-sites-dialogs'
import { ThirdPartySitesProvider } from '../third-party-sites-provider'
import { ThirdPartySitesTable } from '../third-party-sites-table'

const site: ThirdPartySite = {
  id: 5,
  name: 'Alpha',
  type: 'newapi',
  base_url: 'https://alpha.example.com',
  remote_user_id: 7,
  receivable_discount: 0.85,
  created_time: 1,
  updated_time: 1,
}

const clients: QueryClient[] = []
let i18n: I18n

async function renderPage(items: ThirdPartySite[] = [site], lng = 'en') {
  const get = vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: { items, total: items.length, page: 1, page_size: 10 },
    },
  })
  i18n = createInstance()
  await i18n.init({ lng, resources: {}, initAsync: false })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const pageRoute = createRoute({
    getParentRoute: () => auth,
    path: 'third-party-sites/',
    component: () => (
      <ThirdPartySitesProvider>
        <ThirdPartySitesTable />
        <ThirdPartySitesDialogs />
      </ThirdPartySitesProvider>
    ),
  })
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([pageRoute])]),
    history: createMemoryHistory({ initialEntries: ['/third-party-sites/'] }),
  })
  await router.load()
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  return get
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  clients.splice(0).forEach((client) => client.clear())
  vi.restoreAllMocks()
})

function spyToasts() {
  return {
    success: vi.spyOn(toast, 'success').mockImplementation(() => 1),
    error: vi.spyOn(toast, 'error').mockImplementation(() => 1),
  }
}

async function confirmDelete(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('Alpha')
  await user.click(screen.getByRole('button', { name: 'Open menu' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
}

describe('ThirdPartySitesTable', () => {
  it('renders the site columns and rows', async () => {
    const get = await renderPage()

    expect(await screen.findByText('Alpha')).toBeInTheDocument()
    for (const name of [
      'Name',
      'Type',
      'Site Base URL',
      'Receivable Discount',
      'Remote User ID',
      'Actions',
    ]) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
    expect(screen.getByText('Native NewAPI')).toBeInTheDocument()
    expect(screen.getByText('https://alpha.example.com')).toBeInTheDocument()
    expect(screen.getByText('0.85')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/api/third_party_site/?p=1&page_size=10')
  })

  it.each([
    ['en', '0.85'],
    ['zhCN', '0.85'],
    ['zhTW', '0.85'],
    ['ja', '0.85'],
    ['fr', '0,85'],
    ['ru', '0,85'],
    ['vi', '0,85'],
  ])('formats the discount for %s', async (lng, expected) => {
    await renderPage([site], lng)

    expect(await screen.findByText(expected)).toBeInTheDocument()
  })

  it('falls back to the runtime locale for an invalid language', async () => {
    await renderPage([site], 'zz_invalid')

    const expected = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 4,
    }).format(0.85)
    expect(await screen.findByText(expected)).toBeInTheDocument()
  })

  it('keeps every significant decimal', async () => {
    await renderPage([
      { ...site, id: 1, name: 'A', receivable_discount: 0.3 },
      { ...site, id: 2, name: 'B', receivable_discount: 0.1234 },
    ])

    expect(await screen.findByText('0.3')).toBeInTheDocument()
    expect(screen.getByText('0.1234')).toBeInTheDocument()
  })

  it('reformats the discount when the language changes', async () => {
    await renderPage()
    expect(await screen.findByText('0.85')).toBeInTheDocument()

    await act(() => i18n.changeLanguage('fr'))

    expect(await screen.findByText('0,85')).toBeInTheDocument()
  })

  it('deletes a site after confirmation and refetches', async () => {
    const get = await renderPage()
    const user = userEvent.setup()
    const { success } = spyToasts()
    const del = vi
      .spyOn(api, 'delete')
      .mockResolvedValue({ data: { success: true } })
    await screen.findByText('Alpha')

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(
      within(dialog).getByText(
        'Delete site Alpha? It will no longer appear in the list.'
      )
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() =>
      expect(del).toHaveBeenCalledWith('/api/third_party_site/5')
    )
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    )
    expect(success).toHaveBeenCalledWith('Site deleted successfully')
  })

  it('keeps the delete dialog open when the server rejects the delete', async () => {
    const get = await renderPage()
    const user = userEvent.setup()
    const { success, error } = spyToasts()
    vi.spyOn(api, 'delete').mockResolvedValue({
      data: {
        success: false,
        message: 'Site does not exist',
        message_key: 'Site does not exist',
      },
    })

    await confirmDelete(user)

    await waitFor(() => expect(error).toHaveBeenCalledTimes(1))
    expect(error).toHaveBeenCalledWith('Site does not exist')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(success).not.toHaveBeenCalled()
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('keeps the delete dialog open when the delete request fails', async () => {
    const get = await renderPage()
    const user = userEvent.setup()
    const { success, error } = spyToasts()
    vi.spyOn(api, 'delete').mockRejectedValue(
      new AxiosError(
        'Request failed',
        'ERR_BAD_REQUEST',
        undefined,
        undefined,
        {
          status: 404,
          statusText: 'Not Found',
          headers: {},
          config: { headers: new AxiosHeaders() },
          data: { success: false, message: 'Site does not exist' },
        }
      )
    )

    await confirmDelete(user)

    await waitFor(() => expect(error).toHaveBeenCalledTimes(1))
    expect(error).toHaveBeenCalledWith('Site does not exist')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(success).not.toHaveBeenCalled()
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('opens the edit dialog from the row menu', async () => {
    await renderPage()
    const user = userEvent.setup()
    await screen.findByText('Alpha')

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))

    const dialog = await screen.findByRole('dialog', { name: 'Edit Site' })
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Alpha')
  })

  it('shows the empty state when there are no sites', async () => {
    await renderPage([])

    expect(
      await screen.findByText('No Third-Party Sites Found')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'No third-party sites available. Add your first site to get started.'
      )
    ).toBeInTheDocument()
  })
})
