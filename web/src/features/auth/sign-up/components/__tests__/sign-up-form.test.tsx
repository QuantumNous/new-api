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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast, Toaster } from 'sonner'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { api, clearAuthentication } from '@/lib/api'
import { useAuthStore, type AuthBundle } from '@/stores/auth-store'

import { SignUpForm } from '../sign-up-form'

const bundle: AuthBundle = {
  access_token: 'registration-access-token',
  token_type: 'Bearer',
  access_expires_at: 1_900_000_000,
  user: { id: 23, username: 'new-user', role: 1 },
  session: {
    sid: 'registration-session',
    current: true,
    login_method: 'password',
    ip: '127.0.0.1',
    user_agent: 'test-browser',
    created_at: 1,
    last_active_at: 1,
    expires_at: 1_900_000_000,
  },
}

const originalAdapter = api.defaults.adapter
const queryClients: QueryClient[] = []

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  localStorage.clear()
  clearAuthentication(false)
})

afterEach(() => {
  api.defaults.adapter = originalAdapter
  for (const client of queryClients) client.clear()
  queryClients.length = 0
  clearAuthentication(false)
  toast.dismiss()
  localStorage.clear()
})

function RegistrationDashboard() {
  const user = useAuthStore((state) => state.auth.user)
  return <h1>Dashboard: {user?.username}</h1>
}

async function renderRegistration(response: unknown) {
  const requests: string[] = []
  api.defaults.adapter = async (config) => {
    requests.push(config.url ?? '')
    if (config.url !== '/api/user/register') {
      throw new Error(`Unexpected request: ${config.url}`)
    }
    return {
      data: response,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClients.push(queryClient)
  queryClient.setQueryData(['status'], { oauth_register_enabled: false })
  const root = createRootRoute({ component: Outlet })
  const signUp = createRoute({
    getParentRoute: () => root,
    path: '/sign-up',
    component: SignUpForm,
  })
  const dashboard = createRoute({
    getParentRoute: () => root,
    path: '/dashboard',
    component: RegistrationDashboard,
  })
  const signIn = createRoute({
    getParentRoute: () => root,
    path: '/sign-in',
    component: () => <h1>Sign in</h1>,
  })
  const router = createRouter({
    routeTree: root.addChildren([signUp, dashboard, signIn]),
    history: createMemoryHistory({ initialEntries: ['/sign-up'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  )
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Username'), 'new-user')
  await user.type(screen.getByLabelText('Password'), 'password123')
  await user.type(screen.getByLabelText('Confirm password'), 'password123')
  await user.click(screen.getByRole('button', { name: 'Create account' }))
  return { requests, router }
}

describe('registration login', () => {
  test('a successful registration bundle signs in and opens the dashboard without another login request', async () => {
    const { requests, router } = await renderRegistration({
      success: true,
      data: bundle,
    })

    expect(
      await screen.findByRole('heading', { name: 'Dashboard: new-user' })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/dashboard')
    expect(useAuthStore.getState().auth.accessToken).toBe(bundle.access_token)
    expect(useAuthStore.getState().auth.session?.sid).toBe(bundle.session.sid)
    expect(requests).toEqual(['/api/user/register'])
    expect(
      await screen.findByText('Signed in successfully!')
    ).toBeInTheDocument()
  })

  test.each([undefined, { access_token: 'incomplete' }])(
    'a created account without a valid bundle goes to sign-in with a clear account-created message',
    async (data) => {
      await renderRegistration({ success: true, data })

      expect(
        await screen.findByRole('heading', { name: 'Sign in' })
      ).toBeInTheDocument()
      expect(
        await screen.findByText('Account created! Please sign in')
      ).toBeInTheDocument()
      expect(useAuthStore.getState().auth.accessToken).toBeNull()
    }
  )

  test('a rejected registration stays on the form and does not authenticate', async () => {
    const { router } = await renderRegistration({
      success: false,
      message: 'Username already exists',
    })

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Create account' })
      ).toBeEnabled()
    )
    expect(router.state.location.pathname).toBe('/sign-up')
    expect(useAuthStore.getState().auth.user).toBeNull()
    expect(
      screen.queryByText('Account created! Please sign in')
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByText('Username already exists').length
    ).toBeGreaterThan(0)
  })
})
