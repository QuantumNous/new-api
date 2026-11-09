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

import { SignUpForm } from '../sign-up-form'

vi.mock('@/shared/hooks/use-status', () => ({
  useStatus: () => ({
    status: {
      oauth_register_enabled: false,
      wechat_login: false,
    },
    loading: false,
    error: null,
  }),
}))

const SUCCESS_MESSAGE = 'Account created successfully. Please log in.'
const TIMEOUT_MESSAGE =
  'Network timeout. The server took too long to respond. Please try again.'

function renderSignUp() {
  const root = createRootRoute({ component: Outlet })
  const router = createRouter({
    routeTree: root.addChildren([
      createRoute({
        getParentRoute: () => root,
        path: '/sign-up',
        component: SignUpForm,
      }),
      createRoute({
        getParentRoute: () => root,
        path: '/login',
        component: () => <div>Sign in page</div>,
      }),
    ]),
    history: createMemoryHistory({ initialEntries: ['/sign-up'] }),
  })
  render(<RouterProvider router={router} />)
  return router
}

async function submitRegistration() {
  const user = userEvent.setup()
  await user.type(
    await screen.findByPlaceholderText('Enter your username'),
    'new-user'
  )
  await user.type(
    screen.getByPlaceholderText(/Enter password/),
    'password123'
  )
  await user.type(screen.getByPlaceholderText('Confirm password'), 'password123')
  await user.click(screen.getByRole('button', { name: 'Create account' }))
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('sign-up completion', () => {
  it('shows the success toast and routes to /login after registration', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({
      data: { success: true, message: '' },
    })
    const success = vi.spyOn(toast, 'success')

    const router = renderSignUp()
    await submitRegistration()

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(success).toHaveBeenCalledWith(SUCCESS_MESSAGE)
  })

  it('clears the spinner and stays on the form when registration times out', async () => {
    vi.spyOn(api, 'post').mockRejectedValue({ code: 'ECONNABORTED' })
    const error = vi.spyOn(toast, 'error')

    const router = renderSignUp()
    await submitRegistration()

    await waitFor(() => expect(error).toHaveBeenCalledWith(TIMEOUT_MESSAGE))
    expect(router.state.location.pathname).toBe('/sign-up')
    expect(
      screen.getByRole('button', { name: 'Create account' })
    ).toBeEnabled()
  })
})
