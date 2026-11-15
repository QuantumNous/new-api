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
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { CustomPageEmbed } from '..'
import { getCustomPages } from '../api'

const pages = [
  {
    name: 'Status',
    url: 'https://status.example.com',
    adminOnly: false,
    highlight: false,
  },
  {
    name: 'Private',
    url: 'https://private.example.com',
    adminOnly: true,
    highlight: false,
  },
]
const clients: QueryClient[] = []

beforeEach(() => {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'user', role: 1 })
})
afterEach(() => {
  clients.forEach((client) => client.clear())
  clients.length = 0
  useAuthStore.getState().auth.reset()
})

function renderEmbed(slug: string, cached = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  if (cached) client.setQueryData(['custom-pages'], pages)
  return render(
    <QueryClientProvider client={client}>
      <CustomPageEmbed slug={slug} />
    </QueryClientProvider>
  )
}

it('configured pages render a sandboxed iframe and safe external fallback', () => {
  renderEmbed('status')
  const frame = screen.getByTitle('Status')
  expect(frame).toHaveAttribute('src', 'https://status.example.com')
  expect(frame).toHaveAttribute(
    'sandbox',
    'allow-scripts allow-same-origin allow-forms allow-popups allow-downloads'
  )
  expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer')
  expect(frame).toHaveClass('flex-1', 'min-h-0')
  const external = screen.getByRole('link', { name: 'Open in new tab' })
  expect(external).toHaveAttribute('href', 'https://status.example.com')
  expect(external).toHaveAttribute('target', '_blank')
  expect(external).toHaveAttribute('rel', 'noopener noreferrer')
})

it.each(['missing', 'private'])(
  'unknown or restricted slug %s shows an empty state and no URL',
  (slug) => {
    renderEmbed(slug)
    expect(screen.getByText('Page not found')).toBeInTheDocument()
    expect(screen.queryByTitle('Private')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(
      screen.queryByText('https://private.example.com')
    ).not.toBeInTheDocument()
  }
)

it('administrators can embed administrator-only pages', () => {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'admin', role: 10 })
  renderEmbed('private')
  expect(screen.getByTitle('Private')).toHaveAttribute(
    'src',
    'https://private.example.com'
  )
})

it('pending queries show loading until a valid response arrives', async () => {
  let resolve!: (value: {
    data: { success: boolean; data: typeof pages }
  }) => void
  const response = new Promise<{
    data: { success: boolean; data: typeof pages }
  }>((done) => {
    resolve = done
  })
  vi.spyOn(api, 'get').mockReturnValue(response)
  renderEmbed('status', false)
  expect(screen.getByText('Loading...')).toBeInTheDocument()
  resolve({ data: { success: true, data: pages } })
  expect(await screen.findByTitle('Status')).toBeInTheDocument()
})

it('failed business responses show the error state and never render cached URLs', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: false,
      message: 'Failed to load custom pages',
      data: pages,
    },
  })
  renderEmbed('status', false)
  expect(
    await screen.findByText('Failed to load custom pages')
  ).toBeInTheDocument()
  expect(screen.queryByTitle('Status')).not.toBeInTheDocument()
})

it('API rejects business failures and malformed success envelopes', async () => {
  vi.spyOn(api, 'get')
    .mockResolvedValueOnce({ data: { success: false, message: 'Denied' } })
    .mockResolvedValueOnce({ data: { success: true, data: {} } })
  await expect(getCustomPages()).rejects.toThrow('Denied')
  await expect(getCustomPages()).rejects.toThrow('Failed to load custom pages')
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/custom-pages'))
})
