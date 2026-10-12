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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { LogSettingsSection } from '../log-settings-section'

function Fixture() {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  return (
    <>
      <div ref={setContainer} />
      <SettingsPageProvider actionsContainer={container}>
        <LogSettingsSection
          defaultValues={{
            LogConsumeEnabled: true,
            'log_setting.user_export_enabled': true,
            'log_setting.max_range_days': 30,
          }}
        />
      </SettingsPageProvider>
    </>
  )
}

async function renderSettings() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <Fixture />
    </QueryClientProvider>
  )
  return screen.findByRole('spinbutton', {
    name: 'Longest log time range (days)',
  })
}

beforeEach(() => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: null },
  })
  vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } })
})

test('saving sends only the log export settings that changed', async () => {
  const user = userEvent.setup()
  const days = await renderSettings()
  expect(days).toHaveValue(30)

  await user.click(
    screen.getByRole('switch', { name: 'Allow users to export logs' })
  )
  fireEvent.change(days, { target: { value: '90' } })
  await user.click(screen.getByRole('button', { name: 'Save log settings' }))

  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2))
  expect(api.put).toHaveBeenCalledWith('/api/option/', {
    key: 'log_setting.user_export_enabled',
    value: false,
  })
  expect(api.put).toHaveBeenCalledWith('/api/option/', {
    key: 'log_setting.max_range_days',
    value: 90,
  })
})

test('a time range under one day shows a field error and is not saved', async () => {
  const user = userEvent.setup()
  const days = await renderSettings()

  fireEvent.change(days, { target: { value: '0' } })
  await user.click(screen.getByRole('button', { name: 'Save log settings' }))

  await waitFor(() => expect(days).toHaveAttribute('aria-invalid', 'true'))
  expect(api.put).not.toHaveBeenCalled()
})
