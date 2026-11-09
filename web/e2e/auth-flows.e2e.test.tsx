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
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SignOutDialog } from '@/shared/components/sign-out-dialog'
import { UserAuthForm } from '@/shared/features/auth/sign-in/components/user-auth-form'
import { SignUpForm } from '@/shared/features/auth/sign-up/components/sign-up-form'
import {
  clearAuthenticatedClientState,
  resolveAuthentication,
} from '@/shared/lib/auth-session'
import { api } from '@/shared/lib/http-client'
import { ROLE } from '@/shared/lib/roles'
import { useAuthStore } from '@/shared/stores/auth-store'

import {
  makeBundle,
  resetAuth,
  restoreLocation,
  seedAuthenticated,
  stubLocation,
} from './harness'

// Collect every alternative identity method so the credential paths are the
// ones actually exercised.
vi.mock('@/shared/hooks/use-status', () => ({
  useStatus: () => ({
    status: {
      password_login_enabled: true,
      oauth_register_enabled: false,
      wechat_login: false,
      passkey_login: false,
    },
    loading: false,
    error: null,
  }),
}))

const originalLocation = window.location

function renderAt(
  initialEntry: string,
  routes: { path: string; component: () => React.ReactNode }[]
) {
  const root = createRootRoute({ component: Outlet })
  const router = createRouter({
    routeTree: root.addChildren(
      routes.map((route) =>
        createRoute({
          getParentRoute: () => root,
          path: route.path,
          component: route.component,
        })
      )
    ),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return router
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  resetAuth()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Phase 3.1 - sign-up
// ---------------------------------------------------------------------------

describe('phase 3 - sign-up flow', () => {
  afterEach(() => restoreLocation(originalLocation))

  async function fillRegistration(confirmPassword: string) {
    const user = userEvent.setup()
    await user.type(
      await screen.findByPlaceholderText('Enter your username'),
      'new-account'
    )
    await user.type(
      screen.getByPlaceholderText(/Enter password/),
      'password123'
    )
    await user.type(
      screen.getByPlaceholderText('Confirm password'),
      confirmPassword
    )
    await user.click(screen.getByRole('button', { name: 'Create account' }))
  }

  it('rejects mismatched passwords with a field error and no navigation', async () => {
    const location = stubLocation('/sign-up')
    const post = vi.spyOn(api, 'post')
    renderAt('/sign-up', [
      { path: '/sign-up', component: () => <SignUpForm /> },
      { path: '/login', component: () => <div>Sign in page</div> },
    ])

    await fillRegistration('password124')

    expect(await screen.findByText("Passwords don't match.")).toBeVisible()
    expect(post).not.toHaveBeenCalled()
    expect(location.href).toBe('http://localhost/sign-up')
  })

  it('resets the form and hard-navigates to /login after a valid registration', async () => {
    const location = stubLocation('/sign-up')
    vi.spyOn(api, 'post').mockResolvedValue({
      data: { success: true, message: '' },
    })
    renderAt('/sign-up', [
      { path: '/sign-up', component: () => <SignUpForm /> },
      { path: '/login', component: () => <div>Sign in page</div> },
    ])

    await fillRegistration('password123')

    await waitFor(() => expect(location.href).toBe('/login?registered=1'))
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
    expect(screen.getByPlaceholderText('Enter your username')).toHaveValue('')
  })
})

// ---------------------------------------------------------------------------
// Phase 3.2 - login
// ---------------------------------------------------------------------------

describe('phase 3 - login flow', () => {
  function renderLogin() {
    return renderAt('/login', [
      { path: '/login', component: () => <UserAuthForm /> },
      {
        path: '/app/workspace/$section',
        component: () => <div>Client workspace</div>,
      },
      { path: '/otp', component: () => <div>Otp</div> },
      { path: '/forgot-password', component: () => <div>Forgot</div> },
    ])
  }

  async function submitCredentials(username: string, password: string) {
    const user = userEvent.setup()
    await user.type(
      await screen.findByPlaceholderText('Enter your username or email'),
      username
    )
    await user.type(screen.getByPlaceholderText('Enter password'), password)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
  }

  it('shows an error toast and stays on /login with wrong credentials', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { success: false, message: 'Invalid credentials' },
    })
    const error = vi.spyOn(toast, 'error')
    const router = renderLogin()

    await submitCredentials('audit-user', 'wrong-password')

    await waitFor(() => expect(error).toHaveBeenCalled())
    expect(
      post.mock.calls.some(([url]) => String(url).startsWith('/api/user/login'))
    ).toBe(true)
    expect(router.state.location.pathname).toBe('/login')
    expect(useAuthStore.getState().auth.user).toBeNull()
  })

  it('stores the session in memory and redirects a user to the client portal', async () => {
    vi.spyOn(api, 'post').mockImplementation(async (url) => {
      if (String(url).startsWith('/api/user/login')) {
        return {
          data: { success: true, message: '', data: makeBundle(ROLE.USER) },
        }
      }
      throw new Error(`Unexpected POST ${String(url)}`)
    })
    const router = renderLogin()

    await submitCredentials('audit-user', 'password123')

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/app/workspace/overview')
    )
    expect(useAuthStore.getState().auth.user?.role).toBe(ROLE.USER)
    // The session cookie is HttpOnly and set by the server; the SPA must never
    // mirror credentials into web storage.
    const storedKeys: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key) storedKeys.push(key)
    }
    expect(
      storedKeys.filter((key) =>
        /auth|token|role|user|quota|credential/i.test(key)
      )
    ).toEqual([])
    expect(document.cookie).not.toMatch(/new_api_refresh/)
  })
})

// ---------------------------------------------------------------------------
// Phase 3.3 - session persistence
// ---------------------------------------------------------------------------

describe('phase 3 - session persistence', () => {
  it('recovers an existing session without kicking the user to login', async () => {
    seedAuthenticated(ROLE.USER)
    const outcome = await resolveAuthentication()
    expect(outcome.kind).toBe('authenticated')
    expect(useAuthStore.getState().auth.user?.role).toBe(ROLE.USER)
    expect(useAuthStore.getState().auth.bootstrapState).toBe('complete')
  })
})

// ---------------------------------------------------------------------------
// Phase 3.4 - logout
// ---------------------------------------------------------------------------

describe('phase 3 - logout flow', () => {
  it('clears local state and lands the user on /login', async () => {
    seedAuthenticated(ROLE.USER)
    vi.spyOn(api, 'post').mockResolvedValue({
      data: { success: true, message: '' },
    })
    const router = renderAt('/app/workspace/overview', [
      {
        path: '/app/workspace/overview',
        component: () => <SignOutDialog open onOpenChange={() => undefined} />,
      },
      { path: '/login', component: () => <div>Sign in page</div> },
    ])

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(useAuthStore.getState().auth.user).toBeNull()
      expect(useAuthStore.getState().auth.accessToken).toBeNull()
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })

  it('clearing the authenticated client state wipes memory even if the server call fails', async () => {
    seedAuthenticated(ROLE.ADMIN)
    const queryClient = new QueryClient()
    vi.spyOn(api, 'post').mockRejectedValue(new Error('network down'))

    // The dialog swallows the failure by design; assert the state-clearing
    // helper still removes every in-memory credential.
    clearAuthenticatedClientState(queryClient)

    const { auth } = useAuthStore.getState()
    expect(auth.user).toBeNull()
    expect(auth.accessToken).toBeNull()
    expect(auth.session).toBeNull()
  })
})
