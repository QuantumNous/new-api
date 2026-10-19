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
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { CHANNEL_PRIORITY_GUIDE_KEYS } from '../../constants'
import type {
  PriorityMove,
  PriorityOrder,
} from '../../lib/channel-priority-order'
import type { Channel } from '../../types'
import { ChannelsPrimaryButtons } from '../channels-primary-buttons'
import { ChannelsProvider } from '../channels-provider'
import { ChannelsTable } from '../channels-table'

const initial: PriorityOrder = {
  revision: 'initial',
  items: [
    { id: 1, priority: 100 },
    { id: 2, priority: 80 },
    { id: 3, priority: 0 },
  ],
  changes: [],
}
const applied: PriorityOrder = {
  revision: 'applied',
  items: [
    { id: 1, priority: 100 },
    { id: 2, priority: 80 },
    { id: 3, priority: 90 },
  ],
  changes: [{ id: 3, previous: 0, priority: 90 }],
}
let current: PriorityOrder
let requests: PriorityMove[]
let failSave: boolean
const pointerMethods = [
  'setPointerCapture',
  'releasePointerCapture',
  'hasPointerCapture',
] as const
const originalPointerMethods = pointerMethods.map(
  (name) =>
    [
      name,
      Object.getOwnPropertyDescriptor(HTMLElement.prototype, name),
    ] as const
)
afterEach(() => {
  vi.unstubAllGlobals()
  for (const [name, descriptor] of originalPointerMethods) {
    if (descriptor) {
      Object.defineProperty(HTMLElement.prototype, name, descriptor)
    } else Reflect.deleteProperty(HTMLElement.prototype, name)
  }
  localStorage.clear()
})

function channel(item: { id: number; priority: number | null }): Channel {
  return {
    id: item.id,
    priority: item.priority,
    name: `Channel ${item.id}`,
    type: 1,
    status: 1,
    group: 'default',
    models: 'test-model',
    weight: 10,
    balance: 0,
    response_time: 0,
    test_time: 0,
    channel_info: {},
  } as Channel
}

beforeEach(() => {
  current = initial
  requests = []
  failSave = false
  localStorage.clear()
  for (const key of Object.values(CHANNEL_PRIORITY_GUIDE_KEYS)) {
    localStorage.setItem(key, 'seen')
  }
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'test',
    display_name: 'Test',
    role: 100,
    group: 'default',
  })
  vi.spyOn(api, 'get').mockImplementation(async (url, config) => {
    if (url === '/api/channel/priority/order') {
      return { data: { success: true, data: current } }
    }
    if (url === '/api/channel' || url === '/api/channel/search') {
      const field = config?.params?.sort_by ?? 'priority'
      const desc = config?.params?.sort_order !== 'asc'
      const items = current.items
        .map(channel)
        .sort(
          (a, b) =>
            ((Number(a[field as keyof Channel]) || 0) -
              (Number(b[field as keyof Channel]) || 0)) *
              (desc ? -1 : 1) || b.id - a.id
        )
      return {
        data: {
          success: true,
          data: { items, total: 3, type_counts: { 1: 3 } },
        },
      }
    }
    if (url === '/api/group/') {
      return { data: { success: true, data: ['default'] } }
    }
    return { data: { success: true, data: [] } }
  })
  vi.spyOn(api, 'post').mockImplementation(async (url, body) => {
    if (url !== '/api/channel/priority/reorder') {
      return { data: { success: true } }
    }
    const move = body as PriorityMove
    requests.push(move)
    if (failSave && !move.preview) {
      return {
        data: {
          success: false,
          message: 'Channel priorities changed. Refresh and try again.',
        },
      }
    }
    const joined: PriorityOrder = {
      revision: 'joined',
      items: [
        { id: 1, priority: 100 },
        { id: 2, priority: 80 },
        { id: 3, priority: 80 },
      ],
      changes: [{ id: 3, previous: 0, priority: 80 }],
    }
    let result = applied
    if (move.restore) result = initial
    else if (move.position === 'same') result = joined
    if (!move.preview) current = result
    return { data: { success: true, data: result } }
  })
})

async function mount(view: 'table' | 'card' = 'card', enabled = true) {
  localStorage.setItem('channels:view-mode', view)
  const root = createRootRoute()
  const authenticated = createRoute({
    getParentRoute: () => root,
    id: '_authenticated',
  })
  const channels = createRoute({
    getParentRoute: () => authenticated,
    path: '/channels/',
    validateSearch: (search) => ({ page: 1, pageSize: 10, ...search }),
    component: () => (
      <ChannelsProvider>
        <header>
          <ChannelsPrimaryButtons />
        </header>
        <ChannelsTable />
      </ChannelsProvider>
    ),
  })
  const router = createRouter({
    routeTree: root.addChildren([authenticated.addChildren([channels])]),
    history: createMemoryHistory({ initialEntries: ['/channels/'] }),
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  await screen.findByRole('button', { name: 'Drag mode' })
  if (enabled) {
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Drag mode' })).toBeEnabled()
    )
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Drag mode' }))
    await screen.findByRole('button', { name: 'Reorder channel 3' })
  }
  return { client, router }
}

function orderInView() {
  return [...document.querySelectorAll<HTMLElement>('[data-sortable-id]')].map(
    (element) => element.dataset.sortableId
  )
}

test.each(['table', 'card'] as const)(
  '%s view opens the matching tutorial without enabling drag mode',
  async (view) => {
    await mount(view, false)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Drag mode help' }))
    const guide = within(await screen.findByRole('dialog'))
    expect(
      guide.getByRole('list', {
        name: view === 'card' ? 'Card view' : 'Table view',
      })
    ).toBeVisible()
    await user.click(guide.getByRole('button', { name: 'Got it' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: 'Drag mode' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(requests).toEqual([])
  }
)

test.each(['table', 'card'] as const)(
  '%s keyboard reorder saves priority and undo restores it',
  async (view) => {
    await mount(view)
    const user = userEvent.setup()
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'Reorder channel 3' }),
      { key: 'ArrowUp' }
    )
    await screen.findByRole('button', { name: 'Undo' })
    await waitFor(() =>
      expect(orderInView()).toEqual(['channel:1', 'channel:3', 'channel:2'])
    )
    expect(requests.filter((request) => !request.preview)).toEqual([
      { id: 3, target_id: 2, position: 'before', revision: 'initial' },
    ])
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() =>
      expect(orderInView()).toEqual(['channel:1', 'channel:2', 'channel:3'])
    )
    expect(requests.at(-1)).toEqual({
      revision: 'applied',
      restore: [{ id: 3, previous: 90, priority: 0 }],
    })
  }
)

test('switching sort exits reorder mode without automatically reopening it', async () => {
  await mount()
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'Sort channels by' }))
  await user.click(await screen.findByRole('option', { name: /^ID$/ }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Drag mode' })).toBeDisabled()
  )
  expect(
    screen.queryByRole('button', { name: 'Reorder channel 3' })
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('combobox', { name: 'Sort channels by' }))
  await user.click(await screen.findByRole('option', { name: /^Priority$/ }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Drag mode' })).toBeEnabled()
  )
  expect(
    screen.queryByRole('button', { name: 'Reorder channel 3' })
  ).not.toBeInTheDocument()
  expect(requests).toEqual([])
})

test('failed save restores the visible order and does not offer undo', async () => {
  failSave = true
  await mount()
  fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder channel 3' }), {
    key: 'ArrowUp',
  })
  await waitFor(() => expect(requests).toHaveLength(1))
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Reorder channel 3' })
    ).toBeEnabled()
  )
  expect(orderInView()).toEqual(['channel:1', 'channel:2', 'channel:3'])
  expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
})

test('card and table views share the saved order', async () => {
  await mount()
  const user = userEvent.setup()
  fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder channel 3' }), {
    key: 'ArrowUp',
  })
  await screen.findByRole('button', { name: 'Undo' })
  const views = within(screen.getByRole('group', { name: 'View mode' }))
  views.getByRole('button', { name: 'Card view' }).focus()
  await user.tab()
  expect(views.getByRole('button', { name: 'Table view' })).toHaveFocus()
  await user.keyboard('{Enter}')
  await screen.findByRole('table')
  expect(views.getByRole('button', { name: 'Table view' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  expect(views.getByRole('button', { name: 'Card view' })).toHaveAttribute(
    'aria-pressed',
    'false'
  )
  expect(orderInView()).toEqual(['channel:1', 'channel:3', 'channel:2'])
})

test('mobile view controls stay available with the filter panel collapsed', async () => {
  const original = window.matchMedia
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    ...original(query),
    matches: query === '(max-width: 640px)',
  }))
  await mount('card', false)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Collapse' }))
  expect(
    screen.queryByPlaceholderText('Filter by name, ID, or key...')
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Drag mode' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Table view' }))
  expect(await screen.findByRole('table')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'View' }))
  expect(
    await screen.findByRole('menuitemcheckbox', { name: 'Weight' })
  ).toBeVisible()
})

function pointerGeometry(cardColumns = 3) {
  class TestPointerEvent extends MouseEvent {
    pointerId: number
    constructor(type: string, init: PointerEventInit) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
    }
  }
  vi.stubGlobal('PointerEvent', TestPointerEvent)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      if (this.dataset.sortableId) {
        const index = [
          ...document.querySelectorAll('[data-sortable-id]'),
        ].indexOf(this)
        if (this.tagName === 'TR') {
          return new DOMRect(0, 100 + index * 60, 1000, 60)
        }
        return new DOMRect(
          (index % cardColumns) * 320,
          100 + Math.floor(index / cardColumns) * 220,
          300,
          200
        )
      }
      return new DOMRect(0, 0, 1200, 800)
    }
  )
  for (const name of [
    'setPointerCapture',
    'releasePointerCapture',
    'hasPointerCapture',
  ]) {
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      value: () => false,
    })
  }
}

test.each([
  {
    startY: 174,
    jitterY: 169,
    position: 'same',
    hint: 'Release to join priority 80',
  },
  {
    startY: 165,
    jitterY: 171,
    position: 'before',
    hint: 'Release to insert a new priority tier',
  },
] as const)(
  'table preserves $position mode through small pointer movements',
  async ({ startY, jitterY, position, hint }) => {
    await mount('table')
    pointerGeometry()
    const scope = screen.getByRole('region', { name: 'Channels' })
    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Reorder channel 3' }),
      { pointerId: 1, button: 0, clientX: 20, clientY: 250 }
    )
    fireEvent.pointerMove(scope, { pointerId: 1, clientX: 20, clientY: startY })
    await screen.findByText(hint)
    fireEvent.pointerMove(scope, {
      pointerId: 1,
      clientX: 20,
      clientY: jitterY,
    })
    fireEvent.pointerUp(scope, { pointerId: 1, clientX: 20, clientY: jitterY })
    await screen.findByRole('button', { name: 'Undo' })
    expect(requests.filter((request) => !request.preview)).toEqual([
      { id: 3, target_id: 2, position, revision: 'initial' },
    ])
  }
)

test('the compact table preview respects masked channel names', async () => {
  await mount('table')
  await userEvent.setup().click(screen.getByRole('button', { name: /^Hide$/ }))
  pointerGeometry()
  const scope = screen.getByRole('region', { name: 'Channels' })
  fireEvent.pointerDown(
    screen.getByRole('button', { name: 'Reorder channel 3' }),
    { pointerId: 1, button: 0, clientX: 20, clientY: 250 }
  )
  fireEvent.pointerMove(scope, { pointerId: 1, clientX: 20, clientY: 190 })
  await screen.findByText('Release to join priority 80')
  const ghost = document.querySelector('[data-origin-x]')
  expect(ghost).not.toHaveTextContent('Channel 3')
  expect(ghost).toHaveTextContent('••••')
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(requests.filter((request) => !request.preview)).toEqual([])
})

test('table targets stay in place and the compact preview leaves the target rows visible', async () => {
  await mount('table')
  pointerGeometry()
  const scope = screen.getByRole('region', { name: 'Channels' })
  fireEvent.pointerDown(
    screen.getByRole('button', { name: 'Reorder channel 3' }),
    { pointerId: 1, button: 0, clientX: 20, clientY: 250 }
  )
  fireEvent.pointerMove(scope, { pointerId: 1, clientX: 20, clientY: 105 })
  await screen.findByText('Release to insert a new priority tier')
  for (const row of document.querySelectorAll<HTMLElement>(
    '[data-sortable-id]'
  )) {
    expect(row.style.transform).toBe('')
  }
  const ghost = document.querySelector<HTMLElement>('[data-origin-x]')
  expect(ghost?.querySelector('tr')).toBeNull()
  expect(
    Number.parseFloat(ghost?.style.width ?? 'Infinity')
  ).toBeLessThanOrEqual(320)
  expect(ghost).toHaveTextContent('Channel 3')
  fireEvent.pointerMove(scope, { pointerId: 1, clientX: 20, clientY: 190 })
  await screen.findByText('Release to join priority 80')
  fireEvent.pointerUp(scope, { pointerId: 1, clientX: 20, clientY: 190 })
  await screen.findByRole('button', { name: 'Undo' })
  expect(requests.filter((request) => !request.preview)).toEqual([
    { id: 3, target_id: 2, position: 'same', revision: 'initial' },
  ])
  for (const row of document.querySelectorAll<HTMLElement>(
    '[data-sortable-id]'
  )) {
    expect(row.style.transform).toBe('')
  }
})

test('dropping below the table rows cancels instead of selecting a distant row', async () => {
  await mount('table')
  pointerGeometry()
  const scope = screen.getByRole('region', { name: 'Channels' })
  fireEvent.pointerDown(
    screen.getByRole('button', { name: 'Reorder channel 3' }),
    { pointerId: 1, button: 0, clientX: 20, clientY: 250 }
  )
  fireEvent.pointerMove(scope, { pointerId: 1, clientX: 20, clientY: 190 })
  await screen.findByText('Release to join priority 80')
  fireEvent.pointerMove(scope, { pointerId: 1, clientX: 20, clientY: 400 })
  await waitFor(() =>
    expect(
      screen.queryByText('Release to join priority 80')
    ).not.toBeInTheDocument()
  )
  fireEvent.pointerUp(scope, { pointerId: 1, clientX: 20, clientY: 400 })
  await waitFor(() =>
    expect(document.querySelector('[data-origin-x]')).not.toBeInTheDocument()
  )
  expect(requests.filter((request) => !request.preview)).toEqual([])
})

test('a card alone on the last grid row still uses horizontal edge targets', async () => {
  await mount()
  pointerGeometry(2)
  const scope = screen.getByRole('region', { name: 'Channels' })
  fireEvent.pointerDown(
    screen.getByRole('button', { name: 'Reorder channel 3' }),
    { pointerId: 1, button: 0, clientX: 20, clientY: 350 }
  )
  fireEvent.pointerMove(scope, { pointerId: 1, clientX: 340, clientY: 150 })
  await screen.findByText('Release to insert a new priority tier')
  fireEvent.pointerUp(scope, { pointerId: 1, clientX: 340, clientY: 150 })
  await screen.findByRole('button', { name: 'Undo' })
  expect(requests.filter((request) => !request.preview)).toEqual([
    { id: 3, target_id: 2, position: 'before', revision: 'initial' },
  ])
})

test('a quick card pointer drag saves even when released before an animation frame', async () => {
  await mount()
  pointerGeometry()
  const handle = screen.getByRole('button', { name: 'Reorder channel 3' })
  const scope = screen.getByRole('region', { name: 'Channels' })
  fireEvent.pointerDown(handle, {
    pointerId: 1,
    button: 0,
    clientX: 660,
    clientY: 130,
  })
  fireEvent.pointerMove(scope, { pointerId: 1, clientX: 340, clientY: 150 })
  fireEvent.pointerUp(scope, { pointerId: 1, clientX: 340, clientY: 150 })
  fireEvent.lostPointerCapture(scope, { pointerId: 1 })
  await screen.findByRole('button', { name: 'Undo' })
  expect(requests.filter((request) => !request.preview)).toEqual([
    { id: 3, target_id: 2, position: 'before', revision: 'initial' },
  ])
  await waitFor(() =>
    expect(document.querySelector('[data-origin-x]')).not.toBeInTheDocument()
  )
  vi.unstubAllGlobals()
})

test('Escape cancels a card drag without saving and removes its ghost', async () => {
  await mount()
  pointerGeometry()
  const scope = screen.getByRole('region', { name: 'Channels' })
  fireEvent.pointerDown(
    screen.getByRole('button', { name: 'Reorder channel 3' }),
    { pointerId: 1, button: 0, clientX: 660, clientY: 130 }
  )
  fireEvent.pointerMove(scope, { pointerId: 1, clientX: 340, clientY: 150 })
  await waitFor(() =>
    expect(document.querySelector('[data-origin-x]')).toBeInTheDocument()
  )
  fireEvent.keyDown(window, { key: 'Escape' })
  await waitFor(() =>
    expect(document.querySelector('[data-origin-x]')).not.toBeInTheDocument()
  )
  expect(requests.filter((request) => !request.preview)).toEqual([])
  expect(orderInView()).toEqual(['channel:1', 'channel:2', 'channel:3'])
  vi.unstubAllGlobals()
})

test('moving from a card edge to its center joins the tier despite the moving placeholder', async () => {
  await mount()
  pointerGeometry()
  const scope = screen.getByRole('region', { name: 'Channels' })
  fireEvent.pointerDown(
    screen.getByRole('button', { name: 'Reorder channel 3' }),
    { pointerId: 1, button: 0, clientX: 660, clientY: 130 }
  )
  fireEvent.pointerMove(scope, { pointerId: 1, clientX: 340, clientY: 150 })
  await waitFor(() =>
    expect(document.querySelector('[data-origin-x]')).toBeInTheDocument()
  )
  expect(orderInView()).toEqual(['channel:1', 'channel:2', 'channel:3'])
  expect(requests.every((request) => request.preview)).toBe(true)
  fireEvent.pointerMove(scope, { pointerId: 1, clientX: 470, clientY: 150 })
  fireEvent.pointerUp(scope, { pointerId: 1, clientX: 470, clientY: 150 })
  await screen.findByRole('button', { name: 'Undo' })
  expect(requests.filter((request) => !request.preview)).toEqual([
    { id: 3, target_id: 2, position: 'same', revision: 'initial' },
  ])
  await waitFor(() =>
    expect(document.querySelector('[data-origin-x]')).not.toBeInTheDocument()
  )
  vi.unstubAllGlobals()
})

test('tag grouping disables reorder mode', async () => {
  localStorage.setItem('enable-tag-mode', 'true')
  await mount('card', false)
  expect(
    screen.getByRole('button', {
      name: 'Drag mode',
    })
  ).toBeDisabled()
  expect(requests).toEqual([])
})

test.each(['table', 'card'] as const)(
  '%s drag handles are hidden by default',
  async (view) => {
    await mount(view, false)
    expect(
      screen.queryByRole('button', { name: 'Reorder channel 3' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drag mode' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  }
)

test.each(['table', 'card'] as const)(
  '%s reordering can be explicitly enabled and finished',
  async (view) => {
    await mount(view, false)
    const user = userEvent.setup()
    screen.getByRole('button', { name: 'Drag mode' }).focus()
    await user.keyboard('{Enter}')
    expect(
      screen.getByRole('button', { name: 'Reorder channel 3' })
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Finish reordering' })
    ).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Finish reordering' }))
    expect(
      screen.queryByRole('button', { name: 'Reorder channel 3' })
    ).not.toBeInTheDocument()
    expect(requests).toEqual([])
    expect(api.get).not.toHaveBeenCalledWith('/api/channel/priority/order')
  }
)

test('the page header provides the single sorting control without an ID switch', async () => {
  await mount('card', false)
  expect(
    screen.queryByRole('switch', { name: 'Sort by ID' })
  ).not.toBeInTheDocument()
  expect(
    screen.getAllByRole('combobox', { name: 'Sort channels by' })
  ).toHaveLength(1)
  expect(
    within(screen.getByRole('banner')).getByRole('combobox', {
      name: 'Sort channels by',
    })
  ).toBeEnabled()
  expect(
    within(screen.getByRole('region', { name: 'Channels' })).queryByRole(
      'combobox',
      { name: 'Sort channels by' }
    )
  ).not.toBeInTheDocument()
})

test('the header places reorder before batch mode while shared display controls stay in the table toolbar', async () => {
  await mount('card', false)
  const user = userEvent.setup()
  const header = within(screen.getByRole('banner'))
  const toolbar = within(screen.getByRole('region', { name: 'Channels' }))
  const reorder = header.getByRole('button', { name: 'Drag mode' })
  reorder.focus()
  await user.tab()
  expect(header.getByRole('button', { name: 'Drag mode help' })).toHaveFocus()
  await user.tab()
  expect(header.getByRole('switch', { name: 'Batch Operations' })).toHaveFocus()
  expect(
    toolbar.queryByRole('button', { name: 'Drag mode' })
  ).not.toBeInTheDocument()
  expect(toolbar.getByRole('button', { name: 'Hide' })).toBeVisible()
  expect(toolbar.getByRole('group', { name: 'View mode' })).toBeVisible()
})

test('the header honors the saved ID preference and changes the shared sort direction', async () => {
  localStorage.setItem('channels-id-sort', 'true')
  await mount('card', false)
  const header = within(screen.getByRole('banner'))
  expect(
    header.getByRole('combobox', { name: 'Sort channels by' })
  ).toHaveTextContent('ID')
  await waitFor(() =>
    expect(orderInView()).toEqual(['channel:3', 'channel:2', 'channel:1'])
  )
  const sort = within(header.getByRole('group', { name: 'Sort channels by' }))
  sort.getByRole('combobox', { name: 'Sort channels by' }).focus()
  const user = userEvent.setup()
  await user.tab()
  expect(sort.getByRole('button', { name: 'Descending' })).toHaveFocus()
  await user.keyboard('{Enter}')
  await waitFor(() =>
    expect(orderInView()).toEqual(['channel:1', 'channel:2', 'channel:3'])
  )
  expect(header.getByRole('button', { name: 'Ascending' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Drag mode' })).toBeDisabled()
})

test('the compact more-actions button opens by keyboard and restores focus on Escape', async () => {
  await mount('card', false)
  const user = userEvent.setup()
  const more = within(screen.getByRole('banner')).getByRole('button', {
    name: 'More actions',
  })
  more.focus()
  await user.keyboard('{Enter}')
  expect(more).toHaveAttribute('aria-expanded', 'true')
  expect(
    await screen.findByRole('menuitem', { name: 'Test All Channels' })
  ).toBeVisible()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(more).toHaveFocus())
  expect(more).toHaveAttribute('aria-expanded', 'false')
})

test('sorting a table column updates the header selection and remains active in card view', async () => {
  await mount('table', false)
  const user = userEvent.setup()
  await user.click(
    within(screen.getByRole('table')).getByRole('button', {
      name: 'Name',
    })
  )
  await user.click(await screen.findByRole('menuitem', { name: 'Asc' }))
  const header = within(screen.getByRole('banner'))
  expect(
    header.getByRole('combobox', { name: 'Sort channels by' })
  ).toHaveTextContent('Name')
  expect(header.getByRole('button', { name: 'Ascending' })).toBeEnabled()
  await user.click(screen.getByRole('button', { name: 'Card view' }))
  expect(
    header.getByRole('combobox', { name: 'Sort channels by' })
  ).toHaveTextContent('Name')
  expect(screen.getByRole('button', { name: 'Drag mode' })).toBeDisabled()
})

test('dropping onto a card that moved into the original slot joins its priority tier', async () => {
  await mount()
  pointerGeometry()
  const scope = screen.getByRole('region', { name: 'Channels' })
  fireEvent.pointerDown(
    screen.getByRole('button', { name: 'Reorder channel 3' }),
    { pointerId: 1, button: 0, clientX: 660, clientY: 130 }
  )
  fireEvent.pointerMove(scope, { pointerId: 1, clientX: 20, clientY: 150 })
  await waitFor(() =>
    expect(document.querySelector('[data-origin-x]')).toBeInTheDocument()
  )
  // Channel 2 now occupies the last slot that channel 3 originally occupied.
  fireEvent.pointerMove(scope, { pointerId: 1, clientX: 790, clientY: 150 })
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(
      'Join the same priority tier'
    )
  )
  expect(
    document.querySelector(
      '[data-origin-x] [data-column-id="priority"] [data-slot="numeric-spinner-value"]'
    )
  ).toHaveTextContent('80')
  expect(
    document.querySelector('[data-sortable-id="channel:2"]')
  ).toHaveAttribute('data-priority-drop', 'same')
  fireEvent.pointerUp(scope, { pointerId: 1, clientX: 790, clientY: 150 })
  await screen.findByRole('button', { name: 'Undo' })
  expect(requests.filter((request) => !request.preview)).toEqual([
    { id: 3, target_id: 2, position: 'same', revision: 'initial' },
  ])
})

test.each(['table', 'card'] as const)(
  '%s keeps a held tier preview until Escape cancels it',
  async (view) => {
    await mount(view)
    pointerGeometry()
    const scope = screen.getByRole('region', { name: 'Channels' })
    const source = document.querySelector(
      '[data-sortable-id="channel:3"]'
    ) as HTMLElement
    const start =
      view === 'table'
        ? { clientX: 20, clientY: 250 }
        : { clientX: 660, clientY: 130 }
    const target =
      view === 'table'
        ? { clientX: 20, clientY: 190 }
        : { clientX: 470, clientY: 150 }
    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Reorder channel 3' }),
      { pointerId: 1, button: 0, ...start }
    )
    fireEvent.pointerMove(scope, { pointerId: 1, ...target })
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Join the same priority tier'
      )
    )
    expect(source.isConnected).toBe(true)
    expect(source).toHaveStyle({ opacity: '0.2' })
    expect(
      document.querySelector(
        '[data-origin-x] [data-column-id="priority"] [data-slot="numeric-spinner-value"]'
      )
    ).toHaveTextContent('80')
    expect(
      document.querySelector('[data-sortable-id="channel:2"]')
    ).toHaveAttribute('data-priority-drop', 'same')
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() =>
      expect(document.querySelector('[data-origin-x]')).not.toBeInTheDocument()
    )
    expect(
      document.querySelector('[data-priority-drop]')
    ).not.toBeInTheDocument()
    expect(source.style.opacity).toBe('')
    expect(source.style.transform).toBe('')
    expect(requests.filter((request) => !request.preview)).toEqual([])
  }
)

test.each(['table', 'card'] as const)(
  '%s distinguishes inserting a new tier from joining the target tier before release',
  async (view) => {
    await mount(view)
    pointerGeometry()
    const scope = screen.getByRole('region', { name: 'Channels' })
    const start =
      view === 'table'
        ? { clientX: 20, clientY: 250 }
        : { clientX: 660, clientY: 130 }
    const edge =
      view === 'table'
        ? { clientX: 20, clientY: 165 }
        : { clientX: 340, clientY: 150 }
    const center =
      view === 'table'
        ? { clientX: 20, clientY: 190 }
        : { clientX: 470, clientY: 150 }
    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Reorder channel 3' }),
      { pointerId: 1, button: 0, ...start }
    )
    fireEvent.pointerMove(scope, { pointerId: 1, ...edge })
    await screen.findByText('Release to insert a new priority tier')
    expect(document.querySelector('[data-priority-insertion]')).toBeVisible()
    expect(
      document.querySelector('[data-priority-drop="same"]')
    ).not.toBeInTheDocument()
    await screen.findByText('New priority: 90')
    fireEvent.pointerMove(scope, { pointerId: 1, ...center })
    await screen.findByText('Release to join priority 80')
    expect(
      screen.queryByText('Release to insert a new priority tier')
    ).not.toBeInTheDocument()
    expect(
      document.querySelector('[data-priority-insertion]')
    ).not.toBeVisible()
    expect(
      document.querySelector('[data-sortable-id="channel:2"]')
    ).toHaveAttribute('data-priority-drop', 'same')
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() =>
      expect(
        screen.queryByText('Release to join priority 80')
      ).not.toBeInTheDocument()
    )
  }
)
