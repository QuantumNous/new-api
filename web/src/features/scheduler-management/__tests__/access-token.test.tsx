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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import type { SchedulerConfig } from '../api'
import { SchedulerConfigPage } from '../config'

const schedulerConfig: SchedulerConfig = {
  enabled: true,
  bootstrap_urls: 'http://node-a:18080,http://node-b:18080',
  local_url: 'http://127.0.0.1:18080',
  token_set: true,
  mode: 'shadow',
  canary_percent: 0,
  canary_salt: 'scheduler-v2',
  shadow_timeout_ms: 100,
  runtime_prefix: 'new-api:scheduler:runtime',
  runtime_high_watermark: 0.8,
  signing_secret_set: false,
  catalog_token_set: true,
  emergency_native_routing: false,
  emergency_max_duration_seconds: 600,
  emergency_groups: '',
  emergency_models: '',
  emergency_local_switch: false,
  kill_switch: false,
}

type ApiMethod = (
  url: string,
  data?: unknown
) => Promise<{ data: Record<string, unknown> }>
type MockableApi = { get: ApiMethod; put: ApiMethod }

const apiClient = api as unknown as MockableApi
const originalGet = apiClient.get
const originalPut = apiClient.put

afterEach(() => {
  apiClient.get = originalGet
  apiClient.put = originalPut
})

describe('Scheduler unified access token', () => {
  test('shows one token field and submits it for both Scheduler API scopes', async () => {
    apiClient.get = vi.fn(async () => ({
      data: { success: true, data: schedulerConfig },
    }))
    apiClient.put = vi.fn(async () => ({
      data: { success: true, data: schedulerConfig },
    }))

    render(<SchedulerConfigPage />)

    const tokenInput = await screen.findByLabelText('Scheduler access token')
    expect(screen.queryByLabelText('Service token')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Admin token')).not.toBeInTheDocument()

    fireEvent.change(tokenInput, { target: { value: 'shared-token' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/scheduler/config',
        expect.objectContaining({ token: 'shared-token' })
      )
    })
    const payload = vi.mocked(apiClient.put).mock.calls[0]?.[1]
    expect(payload).not.toHaveProperty('service_token')
    expect(payload).not.toHaveProperty('admin_token')
  })
})
