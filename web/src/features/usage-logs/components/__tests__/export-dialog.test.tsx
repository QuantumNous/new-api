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
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { ROLE } from '@/lib/roles'
import { STATUS_QUERY_KEY } from '@/lib/status-query'
import { useAuthStore } from '@/stores/auth-store'

import { ExportLogsDialog } from '../dialogs/export-logs-dialog'
import { UsageLogsProvider } from '../usage-logs-provider'

const DAY_MS = 24 * 60 * 60 * 1000
const createObjectURL = vi.fn((_blob: Blob) => 'blob:logs')

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectURL,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(URL, 'createObjectURL')
  Reflect.deleteProperty(URL, 'revokeObjectURL')
  useAuthStore.getState().auth.reset()
})

function renderExport(options: {
  role: number
  status?: Record<string, unknown>
  search: Record<string, string | number>
}) {
  useAuthStore.setState((state) => ({
    auth: {
      ...state.auth,
      user: { id: 7, username: 'alice', role: options.role },
      accessToken: 'test-token',
      accessExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    },
  }))
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(STATUS_QUERY_KEY, options.status ?? {})
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const logs = createRoute({
    getParentRoute: () => auth,
    path: '/usage-logs/$section',
    component: () => (
      <UsageLogsProvider>
        <h1>Common Logs</h1>
        <ExportLogsDialog />
      </UsageLogsProvider>
    ),
    validateSearch: (search: Record<string, unknown>) => search,
  })
  const query = new URLSearchParams(
    Object.entries(options.search).map(([key, value]) => [key, String(value)])
  )
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([logs])]),
    history: createMemoryHistory({
      initialEntries: [`/usage-logs/common?${query}`],
    }),
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return router
}

function mockExportResponse(lines: unknown[]) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(lines.map((line) => JSON.stringify(line)).join('\n'))
    )
}

const recentRange = () => ({
  startTime: Date.now() - DAY_MS,
  endTime: Date.now(),
})

it('hides Export from users when the administrator turned user export off', async () => {
  renderExport({
    role: ROLE.USER,
    status: { log_export_enabled: false },
    search: recentRange(),
  })

  await screen.findByRole('heading', { name: 'Common Logs' })
  expect(screen.queryByRole('button', { name: 'Export' })).toBeNull()
})

it('keeps Export for administrators when user export is off', async () => {
  renderExport({
    role: ROLE.ADMIN,
    status: { log_export_enabled: false },
    search: recentRange(),
  })

  expect(await screen.findByRole('button', { name: 'Export' })).toBeVisible()
})

it('blocks a range longer than the configured limit before any request', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
  const user = userEvent.setup()
  renderExport({
    role: ROLE.USER,
    status: { log_max_range_days: 7 },
    search: { startTime: Date.now() - 10 * DAY_MS, endTime: Date.now() },
  })

  await user.click(await screen.findByRole('button', { name: 'Export' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The time range cannot exceed 7 days'
  )
  expect(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Export' })
  ).toBeDisabled()
  expect(fetchSpy).not.toHaveBeenCalled()
})

it('downloads the streamed logs of the current filters as CSV', async () => {
  const fetchSpy = mockExportResponse([
    {
      id: 1,
      created_at: 1760000000,
      type: 2,
      content: '',
      token_name: 'prod',
      model_name: 'gpt-4o',
      quota: 0,
      other: '',
      request_id: 'req-2',
    },
    {
      id: 2,
      created_at: 1759990000,
      type: 2,
      content: '',
      token_name: 'prod',
      model_name: 'gpt-4o',
      quota: 0,
      other: '',
      request_id: 'req-1',
    },
    { success: true, message: '', data: { count: 2 } },
  ])
  const success = vi.spyOn(toast, 'success')
  const user = userEvent.setup()
  const range = recentRange()
  renderExport({ role: ROLE.USER, search: { ...range, model: 'gpt-4o' } })

  await user.click(await screen.findByRole('button', { name: 'Export' }))
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Export' })
  )

  await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1))
  const [url] = fetchSpy.mock.calls[0]
  const params = new URL(String(url), 'http://localhost').searchParams
  expect(String(url)).toMatch(/^\/api\/log\/self\/export\?/)
  expect(params.get('model_name')).toBe('gpt-4o')
  expect(params.get('start_timestamp')).toBe(
    String(Math.floor(range.startTime / 1000))
  )
  expect(params.has('p')).toBe(false)
  const file = createObjectURL.mock.calls[0][0]
  const bytes = new Uint8Array(await file.arrayBuffer())
  expect(bytes.subarray(0, 3)).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]))
  const rows = (await file.text()).trimEnd().split('\r\n')
  expect(rows).toHaveLength(3)
  expect(rows[1]).toContain('"req-2"')
  expect(rows[2]).toContain('"req-1"')
  expect(success).toHaveBeenCalledWith('Exported 2 logs')
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

it('reports a server refusal and keeps the dialog open without a download', async () => {
  mockExportResponse([
    {
      success: false,
      message: 'Another log export is running. Try again after it finishes.',
      message_key:
        'Another log export is running. Try again after it finishes.',
    },
  ])
  const error = vi.spyOn(toast, 'error')
  const user = userEvent.setup()
  renderExport({ role: ROLE.ADMIN, search: recentRange() })

  await user.click(await screen.findByRole('button', { name: 'Export' }))
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Export' })
  )

  await waitFor(() =>
    expect(error).toHaveBeenCalledWith(
      'Another log export is running. Try again after it finishes.'
    )
  )
  expect(createObjectURL).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog')).toBeVisible()
})

it('treats a stream that ends without the success line as a failed export', async () => {
  mockExportResponse([
    {
      id: 1,
      created_at: 1760000000,
      type: 2,
      content: '',
      token_name: 'prod',
      model_name: 'gpt-4o',
      quota: 0,
      other: '',
    },
  ])
  const error = vi.spyOn(toast, 'error')
  const user = userEvent.setup()
  renderExport({ role: ROLE.ADMIN, search: recentRange() })

  await user.click(await screen.findByRole('button', { name: 'Export' }))
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Export' })
  )

  await waitFor(() =>
    expect(error).toHaveBeenCalledWith('Failed to export logs')
  )
  expect(createObjectURL).not.toHaveBeenCalled()
})
