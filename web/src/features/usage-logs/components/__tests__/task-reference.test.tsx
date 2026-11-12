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
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import en from '@/i18n/locales/en.json'

import type { UsageLog } from '../../data/schema'
import { useCommonLogsColumns } from '../columns/common-logs-columns'
import { DetailsDialog } from '../dialogs/details-dialog'
import { TaskLogsFilterBar } from '../task-logs-filter-bar'
import { UsageLogsProvider } from '../usage-logs-provider'

vi.mock('@lobehub/icons', () => ({}))
beforeEach(() => vi.spyOn(window, 'scrollTo').mockImplementation(() => {}))
afterEach(() => {
  delete (navigator as { clipboard?: Clipboard }).clipboard
})

const i18n = createInstance()
await i18n.init({ lng: 'en', resources: { en } })

function makeLog(type: number, other: Record<string, unknown>): UsageLog {
  return {
    id: 1,
    user_id: 1,
    created_at: 1,
    type,
    content: '',
    username: 'user',
    token_name: 'token',
    model_name: 'image-model',
    quota: 5,
    prompt_tokens: 0,
    completion_tokens: 0,
    use_time: 0,
    is_stream: false,
    channel: 1,
    channel_name: '',
    token_id: 1,
    group: 'default',
    ip: '',
    other: JSON.stringify(other),
    request_id: 'req-1',
    upstream_request_id: '',
  }
}

function CommonTaskCell({ log }: { log: UsageLog }) {
  const columns = useCommonLogsColumns(false, false)
  const table = useReactTable({
    data: [log],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })
  const cell = table
    .getRowModel()
    .rows[0].getAllCells()
    .find((item) => item.column.id === 'task_id')
  return cell ? flexRender(cell.column.columnDef.cell, cell.getContext()) : null
}

function renderLog(log: UsageLog, details = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(['pricing'], { data: [], vendors: [] })
  const rootRoute = createRootRoute({
    component: () => (
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <main>
            {details ? (
              <DetailsDialog
                log={log}
                isAdmin={false}
                isRoot={false}
                open
                onOpenChange={() => {}}
              />
            ) : (
              <CommonTaskCell log={log} />
            )}
          </main>
          <Outlet />
        </QueryClientProvider>
      </I18nextProvider>
    ),
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  const taskRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/usage-logs/$section',
    component: () => <div>Task page</div>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, taskRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router} />)
}

function TaskFilterFixture() {
  const table = useReactTable({
    data: [],
    columns: [],
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <UsageLogsProvider>
      <TaskLogsFilterBar table={table} logCategory='task' />
    </UsageLogsProvider>
  )
}

function renderTaskFilter(initialEntry: string) {
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const logs = createRoute({
    getParentRoute: () => auth,
    path: '/usage-logs/$section',
    component: TaskFilterFixture,
    validateSearch: (search: Record<string, unknown>) => search,
  })
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([logs])]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  return router
}

test('common consume log with public task ID offers copy and task navigation', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
  renderLog(makeLog(2, { is_task: true, task_id: 'task-public' }))

  expect(await screen.findByText('task-public')).toBeVisible()
  await userEvent.click(
    screen.getByRole('button', { name: 'Copy to clipboard' })
  )
  expect(writeText).toHaveBeenCalledWith('task-public')
  const link = screen.getByRole('link', { name: 'Task Logs: task-public' })
  const target = new URL(link.getAttribute('href') ?? '', 'http://localhost')
  expect(target.pathname).toBe('/usage-logs/task')
  expect(target.searchParams.get('filter')).toBe('task-public')
  expect(target.searchParams.get('page')).toBe('1')
  await userEvent.click(link)
  expect(await screen.findByText('Task page')).toBeVisible()
})

test('common log without task ID has no task navigation', async () => {
  renderLog(makeLog(2, {}))

  expect(await screen.findByRole('main')).toBeVisible()
  expect(
    screen.queryByRole('link', { name: /Task Logs:/ })
  ).not.toBeInTheDocument()
})

test('refund details show public task ID once and link to task', async () => {
  renderLog(makeLog(6, { task_id: 'task-refund', reason: 'adjustment' }), true)

  expect(await screen.findByRole('dialog')).toBeVisible()
  expect(screen.getAllByText('task-refund')).toHaveLength(1)
  expect(
    screen
      .getByRole('link', { name: 'Task Logs: task-refund' })
      .getAttribute('href')
  ).toContain('filter=task-refund')
})

test('consume details show public task ID', async () => {
  renderLog(makeLog(2, { is_task: true, task_id: 'task-consume' }), true)

  expect(await screen.findByRole('dialog')).toBeVisible()
  expect(screen.getByText('task-consume')).toBeVisible()
})

test('manual task ID search does not apply an implicit today range', async () => {
  const router = renderTaskFilter('/usage-logs/task')
  const input = await screen.findByRole('textbox', { name: 'Task ID' })
  await userEvent.type(input, 'task-old{Enter}')

  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      filter: 'task-old',
      page: 1,
    })
  )
  expect(router.state.location.search).not.toHaveProperty('startTime')
  expect(router.state.location.search).not.toHaveProperty('endTime')
})

test('manual task ID search preserves a date range chosen in the URL', async () => {
  const router = renderTaskFilter(
    '/usage-logs/task?startTime=1700000000000&endTime=1700086400000'
  )
  const input = await screen.findByRole('textbox', { name: 'Task ID' })
  await userEvent.type(input, 'task-old{Enter}')

  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      filter: 'task-old',
      page: 1,
      startTime: 1_700_000_000_000,
      endTime: 1_700_086_400_000,
    })
  )
})

test('manual task ID search preserves a date range selected in the picker', async () => {
  const router = renderTaskFilter('/usage-logs/task')
  const input = await screen.findByRole('textbox', { name: 'Task ID' })
  await userEvent.click(screen.getByRole('button', { name: /^\d{4}-\d{2}/ }))
  fireEvent.change(screen.getByLabelText('Start Time'), {
    target: { value: '2026-09-07T09:30' },
  })
  fireEvent.change(screen.getByLabelText('End Time'), {
    target: { value: '2026-09-08T17:45' },
  })
  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  await userEvent.type(input, 'task-old{Enter}')

  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      filter: 'task-old',
      page: 1,
      startTime: new Date('2026-09-07T09:30').getTime(),
      endTime: new Date('2026-09-08T17:45').getTime(),
    })
  )
})

test('task search after Reset does not inherit the default today range', async () => {
  const router = renderTaskFilter(
    '/usage-logs/task?filter=task-current&startTime=1700000000000&endTime=1700086400000'
  )
  const input = await screen.findByRole('textbox', { name: 'Task ID' })
  await userEvent.click(screen.getByRole('button', { name: 'Reset' }))
  await waitFor(() =>
    expect(router.state.location.search).not.toHaveProperty('startTime')
  )
  await userEvent.type(input, 'task-old{Enter}')

  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      filter: 'task-old',
      page: 1,
    })
  )
  expect(router.state.location.search).not.toHaveProperty('startTime')
  expect(router.state.location.search).not.toHaveProperty('endTime')
})
