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
import { CanceledError } from 'axios'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth-store'

import { GroupMigrationEntry } from '../group-migration-dialog'

const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  history: vi.fn(),
}))
vi.mock('@/lib/api', () => ({
  api: {
    get: (url: string, ...args: unknown[]) =>
      url === '/api/option/group_migration'
        ? Promise.resolve(http.history() ?? []).then((data) => ({
            data: { success: true, data },
          }))
        : http.get(url, ...args),
    post: http.post,
  },
}))

function renderEntry(role = 100, groups = ['vip']) {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'operator', role })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <GroupMigrationEntry groups={groups} />
    </QueryClientProvider>
  )
}

async function enterMigration(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Group migration' }))
  await user.click(await screen.findByRole('button', { name: 'Continue' }))
}

afterEach(() => {
  http.get.mockReset()
  http.post.mockReset()
  http.history.mockReset()
  useAuthStore.getState().auth.reset()
})

describe('group migration preview', () => {
  it('shows loading while migration history is being fetched', async () => {
    http.get.mockResolvedValue({ data: { success: true, data: ['vip'] } })
    http.history.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    renderEntry()
    await enterMigration(user)
    await user.click(
      screen.getByRole('button', { name: 'View migration history' })
    )

    expect(await screen.findByText('Loading...')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('retries a canceled migration-history request when history is opened', async () => {
    http.get.mockResolvedValue({ data: { success: true, data: ['vip'] } })
    http.history
      .mockRejectedValueOnce(new CanceledError())
      .mockResolvedValueOnce([])
    const user = userEvent.setup()
    renderEntry()
    await enterMigration(user)
    await user.click(
      screen.getByRole('button', { name: 'View migration history' })
    )

    expect(await screen.findByText('No migration history yet.')).toBeVisible()
    expect(screen.queryByText('canceled')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(http.history).toHaveBeenCalledTimes(2)
  })

  it('does not disable migration when the history request was canceled', async () => {
    http.get.mockResolvedValueOnce({ data: { success: true, data: ['vip'] } })
    http.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          source: 'vip',
          target: 'premium',
          version: 'current-v1',
          counts: {},
          unfinished_tasks: 0,
          blockers: [],
          execution_blockers: [],
          warnings: [],
        },
      },
    })
    http.history.mockRejectedValueOnce(new CanceledError())
    const user = userEvent.setup()
    renderEntry()
    await enterMigration(user)
    await user.selectOptions(
      await screen.findByLabelText('Source group'),
      'vip'
    )
    await user.type(screen.getByLabelText('Target group name'), 'premium')
    await user.click(screen.getByRole('button', { name: 'Preview impact' }))

    expect(await screen.findByText('current-v1')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Migrate group' })).toBeEnabled()
  })

  it('keeps migration available when loading migration history fails', async () => {
    http.get.mockResolvedValueOnce({ data: { success: true, data: ['vip'] } })
    http.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          source: 'vip',
          target: 'premium',
          version: 'current-v1',
          counts: {},
          unfinished_tasks: 0,
          blockers: [],
          execution_blockers: [],
          warnings: [],
        },
      },
    })
    http.history.mockRejectedValue(new Error('history unavailable'))
    const user = userEvent.setup()
    renderEntry()
    await enterMigration(user)
    await user.selectOptions(
      await screen.findByLabelText('Source group'),
      'vip'
    )
    await user.type(screen.getByLabelText('Target group name'), 'premium')
    await user.click(screen.getByRole('button', { name: 'Preview impact' }))
    await user.click(
      screen.getByRole('button', { name: 'View migration history' })
    )

    expect(await screen.findByText('history unavailable')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Migrate group' })).toBeEnabled()
  })

  it('asks whether settings are saved before opening migration and allows cancel', async () => {
    const user = userEvent.setup()
    renderEntry()

    await user.click(screen.getByRole('button', { name: 'Group migration' }))
    expect(
      await screen.findByText(
        'Make sure group settings are saved before continuing.'
      )
    ).toBeVisible()
    expect(screen.queryByLabelText('Source group')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Source group')).not.toBeInTheDocument()
  })

  it('shows missing participant readiness and prevents confirmation', async () => {
    http.get.mockResolvedValueOnce({ data: { success: true, data: ['vip'] } })
    http.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          source: 'vip',
          target: 'premium',
          version: 'v1',
          counts: {},
          unfinished_tasks: 0,
          blockers: [],
          execution_blockers: [],
          warnings: [],
          coordination: {
            ready: false,
            reason: 'Participant unavailable',
            nodes: [
              { name: 'node-a', phase: 'ready', revision: 2 },
              { name: 'node-b', phase: '', revision: 0 },
            ],
          },
        },
      },
    })
    const user = userEvent.setup()
    renderEntry()
    await enterMigration(user)
    await screen.findByRole('option', { name: 'vip' })
    await user.selectOptions(screen.getByLabelText('Source group'), 'vip')
    await user.type(screen.getByLabelText('Target group name'), 'premium')
    await user.click(screen.getByRole('button', { name: 'Preview impact' }))
    expect(await screen.findByText('Participant unavailable')).toBeVisible()
    expect(screen.getByRole('row', { name: /node-a Ready 2/ })).toBeVisible()
    expect(screen.getByRole('row', { name: /node-b Waiting 0/ })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Migrate group' })).toBeDisabled()
  })
  it('shows synchronization progress for the current operation', async () => {
    http.get.mockResolvedValue({ data: { success: true, data: ['premium'] } })
    http.history.mockReturnValue([
      {
        id: 'cluster-pending',
        source: 'vip',
        target: 'premium',
        state: 'committed',
        reason: '',
        coordination: {
          ready: false,
          reason: 'Waiting for node-b',
          nodes: [
            { name: 'node-a', phase: 'synced', revision: 3 },
            { name: 'node-b', phase: 'drained', revision: 2 },
          ],
        },
      },
    ])
    const user = userEvent.setup()
    renderEntry()
    await enterMigration(user)
    expect(await screen.findByText('Waiting for node-b')).toBeVisible()
    expect(
      screen.getByRole('row', { name: /node-a Configuration synchronized 3/ })
    ).toBeVisible()
    expect(
      screen.getByRole('row', { name: /node-b Requests drained 2/ })
    ).toBeVisible()
  })
  it('requires a fresh preview after abort and gives its confirmation a new operation ID', async () => {
    const preview = {
      source: 'vip',
      target: 'premium',
      version: 'unchanged',
      confirmation: 'first-signature',
      expires_at: 9999999999,
      counts: {},
      unfinished_tasks: 0,
      blockers: [],
      execution_blockers: [],
      warnings: [],
    }
    http.get.mockResolvedValueOnce({ data: { success: true, data: ['vip'] } })
    http.get.mockResolvedValueOnce({ data: { success: true, data: preview } })
    http.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: { ...preview, confirmation: 'renewed-signature' },
      },
    })
    http.history
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          id: 'aborted-01',
          source: 'vip',
          target: 'premium',
          state: 'aborted',
          reason: '',
        },
      ])
      .mockReturnValueOnce([
        {
          id: 'aborted-01',
          source: 'vip',
          target: 'premium',
          state: 'aborted',
          reason: '',
        },
      ])
      .mockReturnValueOnce([
        {
          id: 'completed-02',
          source: 'vip',
          target: 'premium',
          state: 'completed',
          reason: '',
        },
        {
          id: 'aborted-01',
          source: 'vip',
          target: 'premium',
          state: 'aborted',
          reason: '',
        },
      ])
    http.post.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: 'aborted-01',
          source: 'vip',
          target: 'premium',
          state: 'aborted',
          reason: '',
        },
      },
    })
    http.post.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: 'completed-02',
          source: 'vip',
          target: 'premium',
          state: 'completed',
          reason: '',
        },
      },
    })
    const user = userEvent.setup()
    renderEntry()
    await enterMigration(user)
    await screen.findByRole('option', { name: 'vip' })
    await user.selectOptions(screen.getByLabelText('Source group'), 'vip')
    await user.type(screen.getByLabelText('Target group name'), 'premium')
    await user.click(screen.getByRole('button', { name: 'Preview impact' }))
    await user.click(
      await screen.findByRole('button', { name: 'Migrate group' })
    )
    await user.click(screen.getByRole('button', { name: 'Confirm migration' }))
    await user.click(
      screen.getByRole('button', { name: 'View migration history' })
    )
    expect(
      await screen.findByText('Migration aborted; preview and confirm again')
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Migrate group' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Preview impact' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Migrate group' })
      ).toBeEnabled()
    )
    await user.click(screen.getByRole('button', { name: 'Migrate group' }))
    await user.click(screen.getByRole('button', { name: 'Confirm migration' }))
    expect(
      await screen.findByText('Migration completed', { selector: 'span' })
    ).toBeVisible()
    expect(http.post.mock.calls[1][1].confirmation).toBe('renewed-signature')
    expect(http.post.mock.calls[1][1].operation_id).not.toBe(
      http.post.mock.calls[0][1].operation_id
    )
  })
  it('allows migrating a recreated source group after an earlier migration completed', async () => {
    http.get.mockResolvedValueOnce({ data: { success: true, data: ['vip'] } })
    http.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          source: 'vip',
          target: 'premium',
          version: 'current-v1',
          counts: {},
          unfinished_tasks: 0,
          blockers: [],
          execution_blockers: [],
          warnings: [],
        },
      },
    })
    http.history.mockReturnValue([
      {
        id: 'previous-vip-migration',
        source: 'vip',
        target: 'premium',
        state: 'completed',
        reason: '',
      },
    ])
    const user = userEvent.setup()
    renderEntry()
    await enterMigration(user)
    await user.selectOptions(
      await screen.findByLabelText('Source group'),
      'vip'
    )
    await user.type(screen.getByLabelText('Target group name'), 'premium')
    await user.click(screen.getByRole('button', { name: 'Preview impact' }))

    expect(await screen.findByText('current-v1')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Migrate group' })).toBeEnabled()
  })
  it('lets the operator verify a terminal operation after a lost response by refreshing it', async () => {
    http.get.mockResolvedValue({ data: { success: true, data: ['vip'] } })
    const operation = {
      id: 'lost-response',
      source: 'vip',
      target: 'premium',
      state: 'aborted',
      reason: '',
    }
    http.history.mockReturnValue([operation])
    const user = userEvent.setup()
    renderEntry()
    await enterMigration(user)
    await user.click(
      screen.getByRole('button', { name: 'View migration history' })
    )
    await user.click(
      await screen.findByRole('button', { name: 'Verify migration status' })
    )
    expect(http.history).toHaveBeenCalledTimes(2)
    expect(http.post).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent(
      /Migration status: Migration aborted; preview and confirm again\. Last checked at \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\./
    )
    expect(
      screen.getByText('Migration aborted; preview and confirm again')
    ).toBeVisible()
  })
  it('checks terminal operation status without resuming and confirms the check', async () => {
    http.get.mockResolvedValue({ data: { success: true, data: ['vip'] } })
    http.history
      .mockReturnValueOnce([
        {
          id: 'completed-operation',
          source: 'vip',
          target: 'premium',
          state: 'completed',
          reason: '',
        },
      ])
      .mockReturnValueOnce([
        {
          id: 'completed-operation',
          source: 'vip',
          target: 'premium',
          state: 'completed',
          reason: '',
        },
      ])
    const user = userEvent.setup()
    renderEntry()
    await enterMigration(user)
    await user.click(
      screen.getByRole('button', { name: 'View migration history' })
    )
    await screen.findByRole('table', { name: 'Migration history' })
    await user.click(
      screen.getByRole('button', { name: 'Verify migration status' })
    )
    expect(http.history).toHaveBeenCalledTimes(2)
    expect(http.post).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent(
      /Migration status: Migration completed\. Last checked at \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\./
    )
  })
  it('reports when the checked operation is no longer in the operation list', async () => {
    http.get.mockResolvedValue({ data: { success: true, data: ['vip'] } })
    http.history
      .mockReturnValueOnce([
        {
          id: 'completed-operation',
          source: 'vip',
          target: 'premium',
          state: 'completed',
          reason: '',
        },
      ])
      .mockReturnValueOnce([])
    const user = userEvent.setup()
    renderEntry()
    await enterMigration(user)
    await user.click(
      screen.getByRole('button', { name: 'View migration history' })
    )
    await screen.findByRole('table', { name: 'Migration history' })
    await user.click(
      screen.getByRole('button', { name: 'Verify migration status' })
    )

    expect(await screen.findByRole('status')).toHaveTextContent(
      /No migration operation found\. Last checked at \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\./
    )
    expect(http.post).not.toHaveBeenCalled()
  })
  it('does not show a status-check action when there is no migration operation', async () => {
    http.get.mockResolvedValue({ data: { success: true, data: ['vip'] } })
    http.history.mockReturnValue([])
    const user = userEvent.setup()
    renderEntry()
    await enterMigration(user)
    await user.click(
      screen.getByRole('button', { name: 'View migration history' })
    )

    expect(
      screen.queryByRole('button', { name: 'Verify migration status' })
    ).not.toBeInTheDocument()
  })
  it('shows multiple migration records in history instead of only the latest one', async () => {
    http.get.mockResolvedValue({ data: { success: true, data: ['vip'] } })
    http.history.mockReturnValue([
      {
        id: 'migration-new',
        source: 'vip',
        target: 'premium',
        state: 'completed',
        created_at: 1782912000,
        updated_at: 1782912060,
        reason: '',
      },
      {
        id: 'migration-old',
        source: 'basic',
        target: 'standard',
        state: 'aborted',
        created_at: 1782825600,
        updated_at: 1782825660,
        reason: '',
      },
    ])
    const user = userEvent.setup()
    renderEntry()
    await enterMigration(user)
    await user.click(
      screen.getByRole('button', { name: 'View migration history' })
    )

    const history = await screen.findByRole('table', {
      name: 'Migration history',
    })
    expect(history).toHaveTextContent('vip → premium')
    expect(history).toHaveTextContent('basic → standard')
    expect(history).toHaveTextContent('migration-new')
    expect(history).toHaveTextContent('migration-old')
    expect(
      screen.getAllByRole('button', { name: 'Verify migration status' })
    ).toHaveLength(2)
  })
  it('confirms an unused group, preserves the rejection reason, and retries the same operation', async () => {
    http.get.mockResolvedValueOnce({ data: { success: true, data: ['vip'] } })
    http.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          source: 'vip',
          target: 'premium',
          version: 'v1',
          confirmation: 'signed-preview',
          expires_at: 9999999999,
          counts: {},
          unfinished_tasks: 0,
          blockers: [],
          execution_blockers: [],
          warnings: [],
        },
      },
    })
    const reason = 'The preview expired or changed. Preview and confirm again.'
    http.post.mockResolvedValueOnce({
      data: { success: false, message: reason },
    })
    http.post.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: 'confirmed-01',
          source: 'vip',
          target: 'premium',
          state: 'completed',
          reason: '',
        },
      },
    })
    const user = userEvent.setup()
    renderEntry()
    await enterMigration(user)
    await screen.findByRole('option', { name: 'vip' })
    await user.selectOptions(screen.getByLabelText('Source group'), 'vip')
    await user.type(screen.getByLabelText('Target group name'), 'premium')
    await user.click(screen.getByRole('button', { name: 'Preview impact' }))
    await user.click(
      await screen.findByRole('button', { name: 'Migrate group' })
    )
    expect(http.post).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Confirm migration' }))
    expect(await screen.findByText(reason)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Confirm migration' }))
    await user.click(
      screen.getByRole('button', { name: 'View migration history' })
    )
    expect(
      await screen.findByText('Migration completed', { selector: 'span' })
    ).toBeVisible()
    expect(http.post).toHaveBeenCalledTimes(2)
    expect(http.post.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        source: 'vip',
        target: 'premium',
        version: 'v1',
        confirmation: 'signed-preview',
        operation_id: expect.any(String),
      })
    )
    expect(http.post.mock.calls[1][1]).toEqual(http.post.mock.calls[0][1])
  })
  it('shows a persisted committed operation and lets the operator resume it', async () => {
    http.get.mockResolvedValue({ data: { success: true, data: ['premium'] } })
    http.history.mockReturnValue([
      {
        id: 'recover-01',
        source: 'vip',
        target: 'premium',
        state: 'committed',
        created_at: 1782912000,
        updated_at: 1782912000,
        reason: '',
      },
    ])
    http.history
      .mockReturnValueOnce([
        {
          id: 'recover-01',
          source: 'vip',
          target: 'premium',
          state: 'committed',
          created_at: 1782912000,
          updated_at: 1782912000,
          reason: '',
        },
      ])
      .mockReturnValueOnce([
        {
          id: 'recover-01',
          source: 'vip',
          target: 'premium',
          state: 'completed',
          created_at: 1782912000,
          updated_at: 1782912060,
          reason: '',
        },
      ])
    http.post.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 'recover-01',
          source: 'vip',
          target: 'premium',
          state: 'completed',
          reason: '',
        },
      },
    })
    const user = userEvent.setup()
    renderEntry()
    await enterMigration(user)
    expect(
      await screen.findByText('Database committed; synchronization pending')
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Resume migration' }))
    await user.click(
      screen.getByRole('button', { name: 'View migration history' })
    )
    expect(
      await screen.findByText('Migration completed', { selector: 'span' })
    ).toBeVisible()
    expect(http.post).toHaveBeenCalledWith(
      '/api/option/group_migration/recover-01/resume',
      undefined,
      expect.any(Object)
    )
  })
  it('shows an invalid target error without requesting a preview', async () => {
    http.get.mockResolvedValueOnce({ data: { success: true, data: ['vip'] } })
    const user = userEvent.setup()
    renderEntry()
    await enterMigration(user)
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
  it('shows saved groups immediately while refreshing the live group list', async () => {
    let fail!: (reason: Error) => void
    http.get.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject
        })
    )
    const user = userEvent.setup()
    renderEntry()
    await enterMigration(user)
    expect(screen.getByRole('option', { name: 'vip' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Preview impact' })
    ).toBeDisabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    fail(new Error('network unavailable'))
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'vip' })).toBeVisible()
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('disables preview when the refreshed list has no ordinary groups', async () => {
    http.get.mockResolvedValueOnce({
      data: { success: true, data: ['default', 'auto'] },
    })
    const user = userEvent.setup()
    renderEntry(100, [])
    await enterMigration(user)
    http.get.mockResolvedValueOnce({
      data: { success: true, data: ['default', 'auto'] },
    })
    expect(
      await screen.findByText('No groups are available for migration.')
    ).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Preview impact' })
    ).toBeDisabled()
  })
  it('keeps saved source groups available when the live list refresh is unauthorized', async () => {
    http.get.mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Unauthorized' } },
    })
    const user = userEvent.setup()
    renderEntry()
    await enterMigration(user)
    expect(await screen.findByRole('option', { name: 'vip' })).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Preview impact' })
    ).toBeDisabled()
  })
  it('shows the preview API message and retries the failed preview request', async () => {
    http.get.mockResolvedValueOnce({ data: { success: true, data: ['vip'] } })
    http.get.mockRejectedValueOnce({
      response: {
        status: 500,
        data: { message: 'Database unavailable' },
      },
    })
    http.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          source: 'vip',
          target: 'premium',
          version: 'v1',
          counts: {},
          unfinished_tasks: 0,
          blockers: [],
          execution_blockers: [],
          warnings: [],
        },
      },
    })
    const user = userEvent.setup()
    renderEntry()
    await enterMigration(user)
    await user.selectOptions(
      await screen.findByLabelText('Source group'),
      'vip'
    )
    await user.type(screen.getByLabelText('Target group name'), 'premium')
    await user.click(screen.getByRole('button', { name: 'Preview impact' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Database unavailable'
    )
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('vip → premium')).toBeVisible()
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
    await enterMigration(user)
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
        name: 'Migrate group',
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
    await enterMigration(user)
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
