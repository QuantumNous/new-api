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
import { toast } from 'sonner'
import { expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { CheckinSettingsSection } from '../checkin-settings-section'

function renderSettings(
  defaultValues = {
    enabled: true,
    paidUsersOnly: false,
    minQuota: 1000,
    maxQuota: 10000,
  }
) {
  function Fixture() {
    const [container, setContainer] = useState<HTMLDivElement | null>(null)
    return (
      <>
        <div ref={setContainer} />
        <SettingsPageProvider actionsContainer={container}>
          <CheckinSettingsSection defaultValues={defaultValues} />
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
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

test.each([false, true])(
  'saving both switches from enabled=%s applies the eligibility guard safely',
  async (initiallyEnabled) => {
    const put = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true } })
    renderSettings({
      enabled: initiallyEnabled,
      paidUsersOnly: initiallyEnabled,
      minQuota: 1000,
      maxQuota: 10000,
    })
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

test.each([
  {
    label: 'Enable check-in feature',
    role: 'switch',
    key: 'enabled',
    initial: true,
    changed: false,
  },
  {
    label: 'Only paying users can check in',
    role: 'switch',
    key: 'paid_users_only',
    initial: false,
    changed: true,
  },
  {
    label: 'Minimum check-in quota',
    role: 'spinbutton',
    key: 'min_quota',
    initial: 1000,
    changed: 2000,
  },
  {
    label: 'Maximum check-in quota',
    role: 'spinbutton',
    key: 'max_quota',
    initial: 10000,
    changed: 20000,
  },
])(
  'reversing $key before refreshed props saves both changes',
  async (field) => {
    const put = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true } })
    renderSettings()
    const input = await screen.findByRole(field.role, { name: field.label })
    const save = await screen.findByRole('button', {
      name: 'Save check-in settings',
    })
    if (field.role === 'switch') {
      fireEvent.click(input)
    } else {
      fireEvent.change(input, { target: { value: field.changed } })
    }
    fireEvent.click(save)
    await waitFor(() => {
      expect(put).toHaveBeenCalledTimes(1)
      if (field.role === 'switch') {
        expect(input).not.toHaveAttribute('aria-disabled', 'true')
      } else {
        expect(input).toBeEnabled()
      }
      expect(
        screen.getByRole('button', { name: 'Save check-in settings' })
      ).toBeDisabled()
    })
    // Keep the original props to model a delayed or failed options refetch.
    if (field.role === 'switch') {
      fireEvent.click(input)
    } else {
      fireEvent.change(input, { target: { value: field.initial } })
    }
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Save check-in settings' })
      ).toBeEnabled()
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Save check-in settings' })
    )
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2))
    expect(put.mock.calls.map((call) => call[1])).toEqual([
      { key: `checkin_setting.${field.key}`, value: String(field.changed) },
      { key: `checkin_setting.${field.key}`, value: String(field.initial) },
    ])
  }
)

test.each(['network', 'business'])(
  'a %s failure saving eligibility never enables check-in and allows retry',
  async (failure) => {
    const put = vi.spyOn(api, 'put')
    if (failure === 'network') {
      put.mockRejectedValueOnce(new Error('Network unavailable'))
    } else {
      put.mockResolvedValueOnce({
        data: { success: false, message: 'Save rejected' },
      })
    }
    put.mockResolvedValue({ data: { success: true } })
    const errorToast = vi.spyOn(toast, 'error')
    renderSettings({
      enabled: false,
      paidUsersOnly: false,
      minQuota: 1000,
      maxQuota: 10000,
    })
    const paid = await screen.findByRole('switch', {
      name: 'Only paying users can check in',
    })
    fireEvent.click(paid)
    fireEvent.click(
      screen.getByRole('switch', { name: 'Enable check-in feature' })
    )
    const save = await screen.findByRole('button', {
      name: 'Save check-in settings',
    })
    fireEvent.click(save)
    await waitFor(() => {
      expect(errorToast).toHaveBeenCalled()
      expect(paid).not.toHaveAttribute('aria-disabled', 'true')
      expect(save).toBeEnabled()
    })
    const guardUpdate = {
      key: 'checkin_setting.paid_users_only',
      value: 'true',
    }
    expect(put.mock.calls.map((call) => call[1])).toEqual([guardUpdate])
    fireEvent.click(save)
    await waitFor(() => {
      expect(put).toHaveBeenCalledTimes(3)
      expect(paid).not.toHaveAttribute('aria-disabled', 'true')
      expect(save).toBeDisabled()
    })
    expect(put.mock.calls.map((call) => call[1])).toEqual([
      guardUpdate,
      guardUpdate,
      { key: 'checkin_setting.enabled', value: 'true' },
    ])
  }
)

test('a partial save retains the saved baseline when reverting before retry', async () => {
  const put = vi
    .spyOn(api, 'put')
    .mockResolvedValueOnce({ data: { success: true } })
    .mockResolvedValueOnce({
      data: { success: false, message: 'Save rejected' },
    })
    .mockResolvedValue({ data: { success: true } })
  const errorToast = vi.spyOn(toast, 'error')
  renderSettings()
  const minQuota = await screen.findByRole('spinbutton', {
    name: 'Minimum check-in quota',
  })
  const paid = screen.getByRole('switch', {
    name: 'Only paying users can check in',
  })
  const save = await screen.findByRole('button', {
    name: 'Save check-in settings',
  })
  fireEvent.change(minQuota, { target: { value: '2000' } })
  fireEvent.click(paid)
  fireEvent.click(save)
  await waitFor(() => {
    expect(errorToast).toHaveBeenCalled()
    expect(paid).not.toHaveAttribute('aria-disabled', 'true')
    expect(save).toBeEnabled()
  })
  fireEvent.change(minQuota, { target: { value: '1000' } })
  fireEvent.click(save)
  await waitFor(() => {
    expect(put).toHaveBeenCalledTimes(4)
    expect(paid).not.toHaveAttribute('aria-disabled', 'true')
    expect(save).toBeDisabled()
  })
  expect(put.mock.calls.map((call) => call[1])).toEqual([
    { key: 'checkin_setting.min_quota', value: '2000' },
    { key: 'checkin_setting.paid_users_only', value: 'true' },
    { key: 'checkin_setting.min_quota', value: '1000' },
    { key: 'checkin_setting.paid_users_only', value: 'true' },
  ])
})

test('a pending save disables all settings until the request finishes', async () => {
  let finishSave = () => {}
  const pendingSave = new Promise<{ data: { success: boolean } }>((resolve) => {
    finishSave = () => resolve({ data: { success: true } })
  })
  const put = vi.spyOn(api, 'put').mockReturnValue(pendingSave)
  renderSettings()
  const paid = await screen.findByRole('switch', {
    name: 'Only paying users can check in',
  })
  fireEvent.click(paid)
  const save = await screen.findByRole('button', {
    name: 'Save check-in settings',
  })
  fireEvent.click(save)
  await waitFor(() => {
    expect(put).toHaveBeenCalledTimes(1)
    for (const input of screen.getAllByRole('switch')) {
      expect(input).toHaveAttribute('aria-disabled', 'true')
    }
    for (const input of screen.getAllByRole('spinbutton')) {
      expect(input).toBeDisabled()
    }
    expect(save).toBeDisabled()
  })
  finishSave()
  await waitFor(() => {
    expect(paid).not.toHaveAttribute('aria-disabled', 'true')
    expect(save).toBeDisabled()
  })
})
