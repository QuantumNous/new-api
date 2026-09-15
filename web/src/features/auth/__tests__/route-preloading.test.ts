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
import { QueryClient } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { Route as SignInRoute } from '@/routes/(auth)/sign-in'
import { Route as SignUpRoute } from '@/routes/(auth)/sign-up'
import { Route as RootRoute } from '@/routes/__root'
import { Route as ProtectedRoute } from '@/routes/_authenticated/route'
import { useAuthStore } from '@/stores/auth-store'
import { createTestAuthBundle } from '@/test-utils/auth-bundle'

const originalAdapter = api.defaults.adapter
const clients: QueryClient[] = []

beforeEach(() => {
  useAuthStore.getState().auth.reset()
  api.defaults.adapter = async (config) => {
    if (config.url !== '/api/setup') {
      throw new Error(`Unexpected request: ${config.url}`)
    }
    return {
      config,
      data: { success: true, data: { status: true } },
      headers: {},
      status: 200,
      statusText: 'OK',
    }
  }
})

afterEach(() => {
  api.defaults.adapter = originalAdapter
  clients.forEach((client) => client.clear())
  clients.length = 0
  useAuthStore.getState().auth.reset()
})

async function createNavigationFixture() {
  const queryClient = new QueryClient()
  clients.push(queryClient)
  const locations: string[] = []
  const loopError = new Error('Route preloading did not terminate')
  vi.spyOn(console, 'error').mockImplementation((error: unknown) => {
    if (error !== loopError) throw error
  })
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({
    beforeLoad: async (context) => {
      locations.push(context.location.href)
      // Bound the known regression so a failing test cannot starve the runner.
      if (locations.length > 12) throw loopError
      return RootRoute.options.beforeLoad?.(context)
    },
  })
  const home = createRoute({ getParentRoute: () => root, path: '/' })
  const authRoute = createRoute({ getParentRoute: () => root, id: '(auth)' })
  const signIn = createRoute({
    getParentRoute: () => authRoute,
    path: '/sign-in',
    beforeLoad: (context) => SignInRoute.options.beforeLoad?.({ ...context }),
    validateSearch: SignInRoute.options.validateSearch,
  })
  const signUp = createRoute({
    getParentRoute: () => authRoute,
    path: '/sign-up',
    beforeLoad: (context) => SignUpRoute.options.beforeLoad?.({ ...context }),
  })
  const protectedRoute = createRoute({
    getParentRoute: () => root,
    id: '_authenticated',
    beforeLoad: (context) =>
      ProtectedRoute.options.beforeLoad?.({ ...context }),
  })
  const dashboard = createRoute({
    getParentRoute: () => protectedRoute,
    path: '/dashboard',
  })
  const keys = createRoute({
    getParentRoute: () => protectedRoute,
    path: '/keys',
  })
  const router = createRouter({
    routeTree: root.addChildren([
      home,
      authRoute.addChildren([signIn, signUp]),
      protectedRoute.addChildren([dashboard, keys]),
    ]),
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  locations.length = 0
  return { router, locations }
}

describe('authentication route preloading', () => {
  test('preloading sign-in while authenticated finishes at the dashboard', async () => {
    useAuthStore.getState().auth.setBundle(createTestAuthBundle())
    const { router } = await createNavigationFixture()

    const matches = await router.preloadRoute({ to: '/sign-in' })

    expect(matches?.at(-1)?.pathname).toBe('/dashboard')
    expect(matches?.at(-1)?.status).toBe('success')
  })

  test('a login return target preserves typed search parameters and its fragment', async () => {
    useAuthStore.getState().auth.setBundle(createTestAuthBundle())
    const { router, locations } = await createNavigationFixture()

    const matches = await router.preloadRoute({
      to: '/sign-in',
      search: { redirect: '/keys?page=2&tags=%5B%22text%22%5D#recent' },
    })

    expect(matches?.at(-1)?.pathname).toBe('/keys')
    expect(matches?.at(-1)?.search).toMatchObject({ page: 2, tags: ['text'] })
    expect(new URL(locations.at(-1) ?? '/', window.location.origin).hash).toBe(
      '#recent'
    )
  })

  test.each(['/sign-in', '/sign-up'] as const)(
    'a user without a token can remain on %s instead of bouncing to the dashboard',
    async (to) => {
      // Explicitly seed the malformed state produced by the old async writeback.
      useAuthStore.setState((state) => ({
        auth: { ...state.auth, user: createTestAuthBundle().user },
      }))
      const { router } = await createNavigationFixture()

      const matches = await router.preloadRoute({ to })

      expect(matches?.at(-1)?.pathname).toBe(to)
      expect(matches?.some((match) => match.error)).toBe(false)
    }
  )

  test.each([
    { to: '/login', expected: '/sign-in' },
    { to: '/console/token', expected: '/keys' },
  ])(
    'preloading legacy $to reaches $expected instead of home',
    async (entry) => {
      if (entry.expected === '/keys') {
        useAuthStore.getState().auth.setBundle(createTestAuthBundle())
      }
      const { router } = await createNavigationFixture()

      const matches = await router.preloadRoute({ to: entry.to })

      expect(matches?.at(-1)?.pathname).toBe(entry.expected)
    }
  )
})
