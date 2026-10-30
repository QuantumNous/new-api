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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth-store'

import { GroupMigrationEntry } from '../group-migration-dialog'

const http = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: http }))

function renderEntry(role = 100) {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'operator', role })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <GroupMigrationEntry />
    </QueryClientProvider>
  )
}

afterEach(() => {
  http.get.mockReset()
  useAuthStore.getState().auth.reset()
})

describe('group migration preview', () => {
  it('shows an invalid target error without requesting a preview', async () => {
    http.get.mockResolvedValueOnce({ data: { success: true, data: ['vip'] } })
    const user = userEvent.setup()
    renderEntry()
    await user.click(screen.getByRole('button', { name: 'Group migration' }))
    await screen.findByRole('option', { name: 'vip' })
    await user.selectOptions(screen.getByLabelText('Source group'), 'vip')
    await user.type(screen.getByLabelText('Target group name'), 'bad,name')
    await user.click(screen.getByRole('button', { name: 'Preview impact' }))
    expect(
      await screen.findByText(
        'Group names must contain 1 to 50 characters without commas, whitespace, control characters or rule prefixes.'
      )
    ).toBeVisible()
    expect(screen.getByLabelText('Target group name')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(http.get).toHaveBeenCalledTimes(1)
  })
  it('keeps preview disabled while loading, after failure, and when no ordinary groups exist', async () => {
    let fail!: (reason: Error) => void
    http.get.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject
        })
    )
    const user = userEvent.setup()
    renderEntry()
    await user.click(screen.getByRole('button', { name: 'Group migration' }))
    expect(screen.getByRole('status')).toHaveTextContent('Loading...')
    expect(
      screen.getByRole('button', { name: 'Preview impact' })
    ).toBeDisabled()
    fail(new Error('network unavailable'))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to inspect group references. Please try again.'
    )
    expect(
      screen.getByRole('button', { name: 'Preview impact' })
    ).toBeDisabled()
    http.get.mockResolvedValueOnce({
      data: { success: true, data: ['default', 'auto'] },
    })
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(
      await screen.findByText('No groups are available for migration.')
    ).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Preview impact' })
    ).toBeDisabled()
  })
  it('uses saved groups, shows impact and blockers, and never executes migration', async () => {
    http.get.mockResolvedValueOnce({
      data: { success: true, data: ['default', 'auto', 'vip'] },
    })
    http.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          source: 'vip',
          target: 'premium',
          version: 'effective-v1',
          counts: { tokens: { records: 2, references: 3 } },
          unfinished_tasks: 1,
          blockers: ['Related unfinished tasks must finish before migration.'],
          warnings: [
            'External scripts must use the new group name after migration.',
          ],
        },
      },
    })
    const user = userEvent.setup()
    renderEntry()
    await user.click(screen.getByRole('button', { name: 'Group migration' }))
    await screen.findByRole('option', { name: 'vip' })
    expect(
      screen.queryByRole('option', { name: 'default' })
    ).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Source group'), 'vip')
    await user.type(screen.getByLabelText('Target group name'), 'premium')
    await user.click(screen.getByRole('button', { name: 'Preview impact' }))
    expect(
      await screen.findByText(
        'Related unfinished tasks must finish before migration.'
      )
    ).toBeVisible()
    expect(screen.getByText('effective-v1')).toBeVisible()
    expect(
      screen.getByText(
        'External scripts must use the new group name after migration.'
      )
    ).toBeVisible()
    expect(
      screen.getByRole('button', {
        name: 'Migration execution is not available yet',
      })
    ).toBeDisabled()
    expect(http.get).toHaveBeenLastCalledWith(
      '/api/option/group_migration/preview',
      expect.objectContaining({ params: { source: 'vip', target: 'premium' } })
    )
    fireEvent.change(screen.getByLabelText('Target group name'), {
      target: { value: 'different' },
    })
    expect(screen.queryByText('effective-v1')).not.toBeInTheDocument()
    expect(http.get).toHaveBeenCalledTimes(2)
  })
  it('hides the entry from administrators without root privileges', () => {
    renderEntry(10)
    expect(
      screen.queryByRole('button', { name: 'Group migration' })
    ).not.toBeInTheDocument()
    expect(http.get).not.toHaveBeenCalled()
  })
  it('discards a response after the names change and supports retry after request failure', async () => {
    http.get.mockResolvedValueOnce({ data: { success: true, data: ['vip'] } })
    let finish!: (value: unknown) => void
    http.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const user = userEvent.setup()
    renderEntry()
    await user.click(screen.getByRole('button', { name: 'Group migration' }))
    await screen.findByRole('option', { name: 'vip' })
    await user.selectOptions(screen.getByLabelText('Source group'), 'vip')
    await user.type(screen.getByLabelText('Target group name'), 'premium')
    await user.click(screen.getByRole('button', { name: 'Preview impact' }))
    fireEvent.change(screen.getByLabelText('Target group name'), {
      target: { value: 'taken' },
    })
    finish({
      data: {
        success: true,
        data: {
          source: 'vip',
          target: 'premium',
          version: 'stale',
          counts: {},
          blockers: [],
          warnings: [],
          unfinished_tasks: 0,
        },
      },
    })
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Preview impact' })
      ).toBeEnabled()
    )
    expect(screen.queryByText('stale')).not.toBeInTheDocument()
    http.get.mockRejectedValueOnce(new Error('request failed'))
    await user.click(screen.getByRole('button', { name: 'Preview impact' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to inspect group references. Please try again.'
    )
    http.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          source: 'vip',
          target: 'taken',
          version: 'v2',
          counts: {},
          blockers: ['Target group is already referenced or configured.'],
          warnings: [],
          unfinished_tasks: 0,
        },
      },
    })
    await user.click(screen.getByRole('button', { name: 'Preview impact' }))
    expect(
      await screen.findByText(
        'Target group is already referenced or configured.'
      )
    ).toBeVisible()
  })
})
