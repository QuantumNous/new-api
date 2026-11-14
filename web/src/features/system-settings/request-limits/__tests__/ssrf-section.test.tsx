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
import { SSRFSection } from '../ssrf-section'

const defaultValues = {
  'fetch_setting.enable_ssrf_protection': true,
  'fetch_setting.allow_private_ip': true,
  'fetch_setting.domain_filter_mode': false,
  'fetch_setting.ip_filter_mode': false,
  'fetch_setting.domain_list': [],
  'fetch_setting.ip_list': [],
  'fetch_setting.allowed_ports': ['80', '443', '8080'],
  'fetch_setting.apply_ip_filter_for_domain': false,
}

function Fixture({
  defaultValues: overrides,
}: {
  defaultValues?: typeof defaultValues
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  return (
    <>
      <div ref={setContainer} />
      <SettingsPageProvider actionsContainer={container}>
        <SSRFSection defaultValues={overrides ?? defaultValues} />
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
  return screen.findByRole('textbox', { name: 'Allowed Ports' })
}

beforeEach(() => {
  vi.spyOn(api, 'get').mockImplementation(async () => ({
    data: { success: true, data: null },
  }))
  vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } })
})

test('saving keeps a port range intact instead of its first number', async () => {
  const user = userEvent.setup()
  const ports = await renderSettings()

  fireEvent.change(ports, { target: { value: '80,443,8000-9000' } })
  await user.click(screen.getByRole('button', { name: 'Save SSRF settings' }))

  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
  expect(api.put).toHaveBeenCalledWith('/api/option/', {
    key: 'fetch_setting.allowed_ports',
    value: '["80","443","8000-9000"]',
  })
})

test('a range with spaces around the hyphen is accepted', async () => {
  const user = userEvent.setup()
  const ports = await renderSettings()

  fireEvent.change(ports, { target: { value: '8000 - 9000,443' } })
  await user.click(screen.getByRole('button', { name: 'Save SSRF settings' }))

  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
  expect(api.put).toHaveBeenCalledWith('/api/option/', {
    key: 'fetch_setting.allowed_ports',
    value: '["8000 - 9000","443"]',
  })
})

test('a field of only separators does not silently drop the restriction', async () => {
  const user = userEvent.setup()
  const ports = await renderSettings()

  fireEvent.change(ports, { target: { value: ',' } })
  await user.click(screen.getByRole('button', { name: 'Save SSRF settings' }))

  expect(
    await screen.findByText(
      'Enter ports or ranges, for example 80,443,8000-9000'
    )
  ).toBeVisible()
  expect(api.put).not.toHaveBeenCalled()
})

test('an unchanged invalid port list does not block toggling protection off', async () => {
  const user = userEvent.setup()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <Fixture
        defaultValues={{
          ...defaultValues,
          'fetch_setting.allowed_ports': ['8000-9000', 'junk'],
        }}
      />
    </QueryClientProvider>
  )

  await user.click(
    await screen.findByRole('switch', { name: 'Enable SSRF Protection' })
  )
  await user.click(screen.getByRole('button', { name: 'Save SSRF settings' }))

  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
  expect(api.put).toHaveBeenCalledWith('/api/option/', {
    key: 'fetch_setting.enable_ssrf_protection',
    value: false,
  })
})

test('an invalid port blocks the save and reports it on the field', async () => {
  const user = userEvent.setup()
  const ports = await renderSettings()

  fireEvent.change(ports, { target: { value: '443,abc' } })
  await user.click(screen.getByRole('button', { name: 'Save SSRF settings' }))

  expect(
    await screen.findByText(
      'Enter ports or ranges, for example 80,443,8000-9000'
    )
  ).toBeVisible()
  expect(api.put).not.toHaveBeenCalled()
})

test('a range whose end is below its start blocks the save and reports it on the field', async () => {
  const user = userEvent.setup()
  const ports = await renderSettings()

  fireEvent.change(ports, { target: { value: '9000-8000' } })
  await user.click(screen.getByRole('button', { name: 'Save SSRF settings' }))

  expect(
    await screen.findByText(
      'Enter ports or ranges, for example 80,443,8000-9000'
    )
  ).toBeVisible()
  expect(api.put).not.toHaveBeenCalled()
})

test('a zero-width no-break space does not pass as a range separator', async () => {
  const user = userEvent.setup()
  const ports = await renderSettings()

  // Go's TrimSpace does not strip U+FEFF, so this would fail every fetch.
  fireEvent.change(ports, { target: { value: '8000\uFEFF-9000' } })
  await user.click(screen.getByRole('button', { name: 'Save SSRF settings' }))

  expect(
    await screen.findByText(
      'Enter ports or ranges, for example 80,443,8000-9000'
    )
  ).toBeVisible()
  expect(api.put).not.toHaveBeenCalled()
})
