import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/shared/lib/api'
import { ROLE } from '@/shared/lib/roles'
import { useAuthStore, type AuthBundle } from '@/shared/stores/auth-store'

import { UserAuthForm } from '../user-auth-form'

// Every alternative identity path is available on this deployment, so the admin
// form can only look credential-only if it actually suppresses them itself.
vi.mock('@/shared/hooks/use-status', () => ({
  useStatus: () => ({
    status: {
      password_login_enabled: true,
      github_oauth: true,
      github_client_id: 'github-client-id',
      passkey_login: true,
      wechat_login: true,
    },
    loading: false,
    error: null,
  }),
}))

const ADMIN_DENIED_MESSAGE = 'Access Denied: Administrator privileges required.'

function createBundle(role: number): AuthBundle {
  return {
    access_token: 'portal-access-token',
    token_type: 'Bearer',
    access_expires_at: 9999999999,
    user: { id: 7, username: 'portal-user', role },
    session: {
      sid: 'portal-session',
      current: true,
      login_method: 'password',
      ip: '',
      user_agent: '',
      created_at: 1,
      last_active_at: 1,
      expires_at: 9999999999,
    },
  }
}

function AdminLoginForm() {
  return (
    <UserAuthForm
      redirectTo='/admin/overview'
      credentialsOnly
      requiredRole={ROLE.ADMIN}
    />
  )
}

function ClientLoginForm() {
  return <UserAuthForm />
}

function renderLoginPage(entry: '/admin/login' | '/login') {
  useAuthStore.getState().auth.reset('complete')
  const root = createRootRoute({ component: Outlet })
  const routes = [
    createRoute({
      getParentRoute: () => root,
      path: '/admin/login',
      component: AdminLoginForm,
    }),
    createRoute({
      getParentRoute: () => root,
      path: '/login',
      component: ClientLoginForm,
    }),
    createRoute({
      getParentRoute: () => root,
      path: '/admin/overview',
      component: () => <div>Admin overview</div>,
    }),
    createRoute({
      getParentRoute: () => root,
      path: '/app/workspace/overview',
      component: () => <div>Client workspace overview</div>,
    }),
    createRoute({
      getParentRoute: () => root,
      path: '/forgot-password',
      component: () => <div>Forgot password</div>,
    }),
  ]
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [entry] }),
  })
  // The client form renders the Passkey domain selector, which reads query state.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return { router, ...view }
}

function mockLogin(role: number) {
  return vi.spyOn(api, 'post').mockImplementation(async (url) => {
    if (String(url).startsWith('/api/user/login')) {
      return {
        data: { success: true, message: '', data: createBundle(role) },
      }
    }
    if (url === '/api/user/auth/logout') {
      return { data: { success: true, message: '' } }
    }
    throw new Error(`Unexpected POST ${String(url)}`)
  })
}

async function submitCredentials() {
  const user = userEvent.setup()
  await user.type(
    await screen.findByPlaceholderText('Enter your username or email'),
    'portal-user'
  )
  await user.type(screen.getByPlaceholderText('Enter password'), 'password')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useAuthStore.getState().auth.reset('idle')
})

describe('admin login form', () => {
  it('renders no OAuth, Passkey or sign-up entry point when credentials are the only allowed method', async () => {
    renderLoginPage('/admin/login')

    expect(
      await screen.findByPlaceholderText('Enter your username or email')
    ).toBeVisible()
    expect(screen.getByPlaceholderText('Enter password')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Continue with/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Passkey/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Sign up' })
    ).not.toBeInTheDocument()
  })

  it('revokes a non-administrator session and keeps them on the admin login page', async () => {
    const post = mockLogin(ROLE.USER)
    const error = vi.spyOn(toast, 'error')
    const { router } = renderLoginPage('/admin/login')

    await submitCredentials()

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(ADMIN_DENIED_MESSAGE)
    )
    expect(useAuthStore.getState().auth.user).toBeNull()
    expect(
      post.mock.calls.some(([url]) => url === '/api/user/auth/logout')
    ).toBe(true)
    expect(router.state.location.pathname).toBe('/admin/login')
  })

  it('routes an administrator to the admin overview', async () => {
    mockLogin(ROLE.ADMIN)
    const { router } = renderLoginPage('/admin/login')

    await submitCredentials()

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/admin/overview')
    )
    expect(useAuthStore.getState().auth.user?.role).toBe(ROLE.ADMIN)
  })
})

describe('client login form', () => {
  it('routes a regular user to the workspace overview section', async () => {
    mockLogin(ROLE.USER)
    const { router } = renderLoginPage('/login')

    await submitCredentials()

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/app/workspace/overview')
    )
  })

  it('routes an administrator to the admin overview instead of the client workspace', async () => {
    mockLogin(ROLE.ADMIN)
    const { router } = renderLoginPage('/login')

    await submitCredentials()

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/admin/overview')
    )
  })
})
