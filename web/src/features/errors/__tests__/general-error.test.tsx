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
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { GeneralError } from '../general-error'

const reload = vi.fn()

beforeEach(() => {
  sessionStorage.clear()
  const realWindow = window
  vi.stubGlobal(
    'window',
    new Proxy(realWindow, {
      get(target, property) {
        if (property === 'location') return { ...target.location, reload }
        return Reflect.get(target, property, target)
      },
    })
  )
})

afterEach(() => {
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

function createTestRouter(error: Error | { response: { status: number } }) {
  const root = createRootRoute({
    component: Outlet,
    errorComponent: GeneralError,
  })
  const home = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => <p>Current page</p>,
  })
  const broken = createRoute({
    getParentRoute: () => root,
    path: '/wallet',
    component: lazyRouteComponent(() => Promise.reject(error)),
  })
  return createRouter({
    routeTree: root.addChildren([home, broken]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    defaultPreload: 'intent',
  })
}

test.each([
  Object.assign(
    new Error('Loading chunk 42 failed. (error: /static/js/async/42.old.js)'),
    { name: 'ChunkLoadError' }
  ),
  Object.assign(
    new Error('Loading CSS chunk 42 failed. (/static/css/42.old.css)'),
    { code: 'CSS_CHUNK_LOAD_FAILED' }
  ),
])(
  'a failed route chunk reloads once, then displays an error without a fake HTTP status: $message',
  async (error) => {
    const router = createTestRouter(error)
    const view = render(<RouterProvider router={router} />)
    await screen.findByText('Current page')
    await act(() => router.navigate({ to: '/wallet' }))
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
    view.unmount()

    const afterReload = createTestRouter(error)
    render(<RouterProvider router={afterReload} />)
    await screen.findByText('Current page')
    await act(() => afterReload.navigate({ to: '/wallet' }))
    expect(await screen.findByText(/Oops! Something went wrong/)).toBeVisible()
    expect(screen.queryByText('500')).not.toBeInTheDocument()
    expect(reload).toHaveBeenCalledTimes(1)
  }
)

test('failed and repeated intent preloads keep the current page usable until navigation', async () => {
  const error = Object.assign(
    new Error('Loading chunk 43 failed. (missing: /43.js)'),
    { name: 'ChunkLoadError' }
  )
  const router = createTestRouter(error)
  render(<RouterProvider router={router} />)
  await screen.findByText('Current page')
  await act(() => router.preloadRoute({ to: '/wallet' }))
  await act(() => router.preloadRoute({ to: '/wallet' }))
  expect(screen.getByText('Current page')).toBeVisible()
  expect(reload).not.toHaveBeenCalled()
  expect(
    screen.queryByText(/Oops! Something went wrong/)
  ).not.toBeInTheDocument()
  await act(() => router.navigate({ to: '/wallet' }))
  await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
})

test.each([undefined, 429, 500])(
  'non-chunk errors preserve their actual HTTP status (%s) without reloading',
  async (status) => {
    const error = status ? { response: { status } } : new Error('Render failed')
    const router = createTestRouter(error)
    render(<RouterProvider router={router} />)
    await screen.findByText('Current page')
    await act(() => router.navigate({ to: '/wallet' }))
    if (status) {
      expect(
        await screen.findByRole('heading', { name: String(status) })
      ).toBeVisible()
    } else {
      expect(screen.queryByText('500')).not.toBeInTheDocument()
    }
    if (status === 429) {
      expect(screen.getByText('Too many requests')).toBeVisible()
      expect(
        screen.getByText(/Please wait a moment before trying again/)
      ).toBeVisible()
    }
    expect(reload).not.toHaveBeenCalled()
  }
)

test('a chunk failure with blocked session storage shows the error without risking a reload loop', async () => {
  vi.stubGlobal('sessionStorage', {
    getItem: () => null,
    setItem: () => {
      throw new Error('Storage blocked')
    },
    clear: () => {},
  })
  const error = Object.assign(
    new Error('Loading chunk 44 failed. (error: /44.js)'),
    { name: 'ChunkLoadError' }
  )
  const router = createTestRouter(error)
  render(<RouterProvider router={router} />)
  await screen.findByText('Current page')
  await act(() => router.navigate({ to: '/wallet' }))
  expect(await screen.findByText(/Oops! Something went wrong/)).toBeVisible()
  expect(screen.queryByText('500')).not.toBeInTheDocument()
  expect(reload).not.toHaveBeenCalled()
})
