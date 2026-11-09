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
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Portal } from '@/shared/lib/portal-url'
import { ROLE } from '@/shared/lib/roles'
import { useAuthStore, type AuthBundle } from '@/shared/stores/auth-store'

import { ProfileDropdown } from '../profile-dropdown'

vi.mock('@/shared/hooks/use-sidebar-config', () => ({
  useIsSidebarModuleVisible: () => true,
}))

function seedUser(role: number): void {
  const bundle: AuthBundle = {
    access_token: 'portal-menu-token',
    token_type: 'Bearer',
    access_expires_at: 9999999999,
    user: { id: 9, username: 'portal-admin', role },
    session: {
      sid: 'portal-menu-session',
      current: true,
      login_method: 'password',
      ip: '',
      user_agent: '',
      created_at: 1,
      last_active_at: 1,
      expires_at: 9999999999,
    },
  }
  useAuthStore.getState().auth.setBundle(bundle)
}

async function renderMenu(portalContext: Portal) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const root = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <ProfileDropdown portalContext={portalContext} />
      </QueryClientProvider>
    ),
  })
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router} />)

  const user = userEvent.setup()
  await user.click(await screen.findByRole('button'))
  return user
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useAuthStore.getState().auth.reset('idle')
})

describe('profile menu portal separation', () => {
  it('hides client-account destinations and links across from the admin portal', async () => {
    seedUser(ROLE.ADMIN)
    await renderMenu('admin')

    expect(
      await screen.findByRole('menuitem', { name: 'Go to Client Portal' })
    ).toBeVisible()
    expect(
      screen.queryByRole('menuitem', { name: 'Profile' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('menuitem', { name: 'Security & Access' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('menuitem', { name: 'Wallet' })
    ).not.toBeInTheDocument()
  })

  it('keeps client-account destinations in the client portal', async () => {
    seedUser(ROLE.USER)
    await renderMenu('client')

    expect(
      await screen.findByRole('menuitem', { name: 'Profile' })
    ).toBeVisible()
    expect(
      screen.queryByRole('menuitem', { name: 'Go to Client Portal' })
    ).not.toBeInTheDocument()
  })
})
