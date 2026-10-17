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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { EmailSettingsSection } from '../email-settings-section'

function Fixture() {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  return (
    <>
      <div ref={setContainer} />
      <SettingsPageProvider actionsContainer={container}>
        <EmailSettingsSection
          defaultValues={{
            SMTPServer: 'smtp.example.com',
            SMTPPort: '587',
            SMTPAccount: 'noreply@example.com',
            SMTPFrom: '',
            SMTPToken: '',
            SMTPSSLEnabled: false,
            SMTPStartTLSEnabled: true,
            SMTPInsecureSkipVerify: false,
            SMTPForceAuthLogin: false,
            QuotaRemindEnabled: true,
            QuotaRemindThreshold: '1000',
          }}
        />
      </SettingsPageProvider>
    </>
  )
}

function renderSettings() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <Fixture />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } })
})

afterEach(() => vi.restoreAllMocks())

test('the default threshold shows as an amount and is not saved again when only SMTP changes', async () => {
  const user = userEvent.setup()
  renderSettings()
  expect(
    screen.getByRole('spinbutton', { name: 'Default reminder threshold (USD)' })
  ).toHaveValue(0.002)
  await user.click(screen.getByRole('switch', { name: 'Force AUTH LOGIN' }))
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith('/api/option/', {
      key: 'SMTPForceAuthLogin',
      value: true,
    })
  )
  expect(api.put).toHaveBeenCalledTimes(1)
})

test('an edited default threshold is saved in quota units', async () => {
  const user = userEvent.setup()
  renderSettings()
  const input = screen.getByRole('spinbutton', {
    name: 'Default reminder threshold (USD)',
  })
  await user.clear(input)
  await user.type(input, '1')
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith('/api/option/', {
      key: 'QuotaRemindThreshold',
      value: '500000',
    })
  )
  expect(api.put).toHaveBeenCalledTimes(1)
})

test('turning the reminder off hides the default threshold and saves the switch', async () => {
  const user = userEvent.setup()
  renderSettings()
  await user.click(screen.getByRole('switch', { name: 'Low balance reminder' }))
  expect(
    screen.queryByRole('spinbutton', {
      name: 'Default reminder threshold (USD)',
    })
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith('/api/option/', {
      key: 'QuotaRemindEnabled',
      value: false,
    })
  )
  expect(api.put).toHaveBeenCalledTimes(1)
})
