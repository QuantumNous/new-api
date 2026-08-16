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
import type { ReactElement } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { WorkerSettingsSection } from '../worker-settings-section'

const apiMocks = vi.hoisted(() => ({
  testWorkerProxy: vi.fn(),
  updateSystemOption: vi.fn(),
}))

vi.mock('../../api', () => apiMocks)

const defaultValues = {
  WorkerUrl: '',
  WorkerValidKey: '',
  UserOutboundRequestsEnabled: false,
  WorkerAllowHttpImageRequestEnabled: false,
}

function renderSection(element: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })

  const result = render(
    <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
  )

  return {
    ...result,
    queryClient,
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('worker settings outbound request controls', () => {
  test('requires confirmation before enabling direct outbound requests without a Worker', async () => {
    apiMocks.updateSystemOption.mockResolvedValue({
      success: true,
      message: '',
    })

    const { container, queryClient } = renderSection(
      <WorkerSettingsSection defaultValues={defaultValues} />
    )

    fireEvent.click(
      screen.getByRole('switch', {
        name: 'Allow user-controlled outbound requests',
      })
    )
    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    if (!form) throw new Error('Worker settings form was not rendered')
    fireEvent.submit(form)

    expect(
      await screen.findByText('Enable outbound requests without a Worker?')
    ).toBeInTheDocument()
    expect(apiMocks.updateSystemOption).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Enable anyway' }))

    await waitFor(() => {
      expect(apiMocks.updateSystemOption).toHaveBeenCalledWith({
        key: 'UserOutboundRequestsEnabled',
        value: true,
      })
    })

    queryClient.clear()
  })

  test('tests the current unsaved Worker URL and access key', async () => {
    apiMocks.testWorkerProxy.mockResolvedValue({
      success: true,
      message: '',
      data: { ip: '203.0.113.10' },
    })

    const { queryClient } = renderSection(
      <WorkerSettingsSection defaultValues={defaultValues} />
    )

    fireEvent.change(screen.getByLabelText('Worker URL'), {
      target: { value: 'https://worker.example.test/path/' },
    })
    fireEvent.change(screen.getByLabelText('Worker Access Key'), {
      target: { value: ' current-key ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Test Worker' }))

    await waitFor(() => {
      expect(apiMocks.testWorkerProxy).toHaveBeenCalledWith({
        worker_url: 'https://worker.example.test/path',
        worker_valid_key: 'current-key',
      })
    })

    queryClient.clear()
  })
})
