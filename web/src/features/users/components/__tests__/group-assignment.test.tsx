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
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import type { User } from '../../types'
import { UsersMutateDrawer } from '../users-mutate-drawer'
import { UsersProvider } from '../users-provider'

const target: User = {
  id: 2,
  username: 'customer',
  display_name: 'Customer',
  role: 1,
  status: 1,
  quota: 0,
  used_quota: 0,
  request_count: 0,
  group: 'default',
}

// A user group that only exists in GroupGroupRatio / group_special_usable_group
// is not returned by /api/group/, which lists GroupRatio keys only.
const ruleOnlyGroup = 'company-a'

function renderDrawer() {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'admin', role: 10 })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/group/') {
      return { data: { success: true, data: ['default', 'vip'] } }
    }
    return { data: { success: true, data: target } }
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <UsersProvider>
        <UsersMutateDrawer
          open
          onOpenChange={() => undefined}
          currentRow={target}
        />
      </UsersProvider>
    </QueryClientProvider>
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useAuthStore.getState().auth.reset()
})

function mockSave() {
  return vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } })
}

async function openGroupField() {
  renderDrawer()
  await screen.findByDisplayValue('Customer')
  return screen.getByRole('combobox', { name: 'Group' })
}

it('saving after picking a listed group sends that group', async () => {
  const put = mockSave()
  const group = await openGroupField()

  await userEvent.clear(group)
  await userEvent.type(group, 'vi')
  await userEvent.click(screen.getByRole('option', { name: 'vip' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() =>
    expect(put).toHaveBeenCalledWith(
      '/api/user/',
      expect.objectContaining({ id: 2, group: 'vip' }),
      {}
    )
  )
})

it.each([
  ['after pressing Enter', `${ruleOnlyGroup}{Enter}`],
  ['without pressing Enter', ruleOnlyGroup],
])(
  'saving a typed user group that is not in the pricing group list sends that group (%s)',
  async (_case, keys) => {
    const put = mockSave()
    const group = await openGroupField()

    await userEvent.clear(group)
    await userEvent.type(group, keys)
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        '/api/user/',
        expect.objectContaining({ id: 2, group: ruleOnlyGroup }),
        {}
      )
    )
  }
)

it.each([
  ['cleared', ''],
  ['whitespace only', '   '],
])(
  'saving with the group %s shows a required error and sends nothing',
  async (_case, text) => {
    const put = mockSave()
    const group = await openGroupField()

    await userEvent.clear(group)
    if (text) await userEvent.type(group, text)
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Group is required')).toBeInTheDocument()
    expect(put).not.toHaveBeenCalled()
  }
)
