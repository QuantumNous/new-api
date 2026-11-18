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
import type { Row } from '@tanstack/react-table'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth-store'

import { manageUser } from '../../api'
import type { User } from '../../types'
import { DataTableRowActions } from '../data-table-row-actions'

const requestVerification = vi.fn()

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('../../api', () => ({
  manageUser: vi.fn(),
  resetUserPasskey: vi.fn(),
  resetUserTwoFA: vi.fn(),
}))

vi.mock('../users-provider', () => ({
  useUsers: () => ({
    setOpen: vi.fn(),
    setCurrentRow: vi.fn(),
    triggerRefresh: vi.fn(),
    requestVerification,
    verificationActive: false,
  }),
}))

vi.mock(
  '@/features/subscriptions/components/dialogs/user-subscriptions-dialog',
  () => ({
    UserSubscriptionsDialog: () => null,
  })
)

vi.mock('../dialogs/user-binding-dialog', () => ({
  UserBindingDialog: () => null,
}))

function makeTarget(role: number): User {
  return {
    id: 7,
    username: 'target-user',
    display_name: 'Target user',
    role,
    status: 1,
    quota: 0,
    used_quota: 0,
    request_count: 0,
    group: 'default',
  }
}

async function openMenuAs(viewerRole: number, targetRole: number) {
  useAuthStore
    .getState()
    .auth.setUser({ id: 1, username: 'viewer', role: viewerRole })
  render(
    <DataTableRowActions
      row={{ original: makeTarget(targetRole) } as Row<User>}
    />
  )
  await userEvent.click(screen.getByRole('button', { name: 'Open menu' }))
}

beforeEach(() => {
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  requestVerification.mockReset()
  vi.mocked(manageUser).mockReset()
  vi.mocked(toast.success).mockReset()
  vi.mocked(toast.error).mockReset()
})

afterEach(() => {
  cleanup()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
})

it('root viewing a common user offers setting but not unsetting a channel supplier', async () => {
  await openMenuAs(100, 1)
  expect(
    screen.getByRole('menuitem', { name: 'Set as channel supplier' })
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('menuitem', { name: 'Unset channel supplier' })
  ).not.toBeInTheDocument()
})

it('root viewing a channel supplier offers unsetting and hides Demote', async () => {
  await openMenuAs(100, 5)
  expect(
    screen.getByRole('menuitem', { name: 'Unset channel supplier' })
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('menuitem', { name: 'Set as channel supplier' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('menuitem', { name: 'Demote' })
  ).not.toBeInTheDocument()
})

it('root viewing an administrator keeps Demote and offers no supplier items', async () => {
  await openMenuAs(100, 10)
  expect(screen.getByRole('menuitem', { name: 'Demote' })).toBeInTheDocument()
  expect(
    screen.queryByRole('menuitem', { name: 'Set as channel supplier' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('menuitem', { name: 'Unset channel supplier' })
  ).not.toBeInTheDocument()
})

it('administrator viewing a channel supplier sees no supplier items and no Demote', async () => {
  await openMenuAs(10, 5)
  expect(
    screen.queryByRole('menuitem', { name: 'Set as channel supplier' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('menuitem', { name: 'Unset channel supplier' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('menuitem', { name: 'Demote' })
  ).not.toBeInTheDocument()
})

it('administrator viewing a common user sees no supplier items', async () => {
  await openMenuAs(10, 1)
  expect(
    screen.queryByRole('menuitem', { name: 'Set as channel supplier' })
  ).not.toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: 'Promote' })).toBeInTheDocument()
})

it('clicking Set as channel supplier verifies with the manage scope then sends the proof', async () => {
  requestVerification.mockResolvedValue({ proof_token: 'proof-1' })
  vi.mocked(manageUser).mockResolvedValue({ success: true })
  await openMenuAs(100, 1)
  await userEvent.click(
    screen.getByRole('menuitem', { name: 'Set as channel supplier' })
  )
  await waitFor(() =>
    expect(manageUser).toHaveBeenCalledWith(
      7,
      'set_channel_supplier',
      'proof-1'
    )
  )
  expect(requestVerification).toHaveBeenCalledWith(
    expect.objectContaining({
      scope: 'admin.user.manage',
      context: { user_id: 7, action: 'set_channel_supplier' },
      title: 'Verify to set channel supplier',
    })
  )
})

it('clicking Unset channel supplier verifies with the manage scope then sends the proof', async () => {
  requestVerification.mockResolvedValue({ proof_token: 'proof-2' })
  vi.mocked(manageUser).mockResolvedValue({ success: true })
  await openMenuAs(100, 5)
  await userEvent.click(
    screen.getByRole('menuitem', { name: 'Unset channel supplier' })
  )
  await waitFor(() =>
    expect(manageUser).toHaveBeenCalledWith(
      7,
      'unset_channel_supplier',
      'proof-2'
    )
  )
  expect(requestVerification).toHaveBeenCalledWith(
    expect.objectContaining({
      scope: 'admin.user.manage',
      context: { user_id: 7, action: 'unset_channel_supplier' },
      title: 'Verify to unset channel supplier',
    })
  )
})

it.each([
  [1, 'Set as channel supplier', 'User set as channel supplier successfully'],
  [5, 'Unset channel supplier', 'User is no longer a channel supplier'],
])(
  'root choosing the menu item for target role %i and succeeding shows the result sentence, not the menu label (%s)',
  async (targetRole, menuLabel, resultMessage) => {
    requestVerification.mockResolvedValue({ proof_token: 'proof-3' })
    vi.mocked(manageUser).mockResolvedValue({ success: true })
    await openMenuAs(100, targetRole)
    await userEvent.click(screen.getByRole('menuitem', { name: menuLabel }))
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(resultMessage)
    )
  }
)

it.each([
  ['Set as channel supplier', 1],
  ['Unset channel supplier', 5],
])(
  'failure without a server message after %s falls back to a readable name, never the raw action key',
  async (menuLabel, targetRole) => {
    requestVerification.mockResolvedValue({ proof_token: 'proof-4' })
    vi.mocked(manageUser).mockResolvedValue({ success: false })
    await openMenuAs(100, targetRole)
    await userEvent.click(screen.getByRole('menuitem', { name: menuLabel }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    const shown = String(vi.mocked(toast.error).mock.calls[0][0])
    expect(shown).not.toContain('channel_supplier')
    expect(shown).toContain(menuLabel)
  }
)

it('cancelling verification from the Set as channel supplier item never calls manageUser', async () => {
  requestVerification.mockResolvedValue(null)
  await openMenuAs(100, 1)
  await userEvent.click(
    screen.getByRole('menuitem', { name: 'Set as channel supplier' })
  )
  await waitFor(() => expect(requestVerification).toHaveBeenCalled())
  expect(manageUser).not.toHaveBeenCalled()
})
