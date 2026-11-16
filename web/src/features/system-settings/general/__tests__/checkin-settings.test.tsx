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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { CheckinSettingsSection } from '../checkin-settings-section'

test.each([false, true])(
  'saving both switches from enabled=%s applies the eligibility guard safely',
  async (initiallyEnabled) => {
    const put = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true } })
    function Fixture() {
      const [container, setContainer] = useState<HTMLDivElement | null>(null)
      return (
        <>
          <div ref={setContainer} />
          <SettingsPageProvider actionsContainer={container}>
            <CheckinSettingsSection
              defaultValues={{
                enabled: initiallyEnabled,
                paidUsersOnly: initiallyEnabled,
                minQuota: 1000,
                maxQuota: 10000,
              }}
            />
          </SettingsPageProvider>
        </>
      )
    }
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    const router = createRouter({
      routeTree: createRootRoute({ component: Fixture }),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )
    const paid = await screen.findByRole('switch', {
      name: 'Only paying users can check in',
    })
    fireEvent.click(paid)
    fireEvent.click(
      screen.getByRole('switch', { name: 'Enable check-in feature' })
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Save check-in settings' })
    )
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2))
    const updates = put.mock.calls.map((call) => call[1])
    const enabledUpdate = {
      key: 'checkin_setting.enabled',
      value: String(!initiallyEnabled),
    }
    const paidUpdate = {
      key: 'checkin_setting.paid_users_only',
      value: String(!initiallyEnabled),
    }
    expect(updates).toEqual(
      initiallyEnabled
        ? [enabledUpdate, paidUpdate]
        : [paidUpdate, enabledUpdate]
    )
  }
)
