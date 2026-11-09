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
import { AxiosError, type AxiosAdapter } from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { iqConfigSchema } from '../config-schema'
import { useIQViewerScope } from '../queries'
import { IQConfigForm } from '../settings'
import type { IQConfig, IQConfigInput } from '../types'

const config: IQConfig = {
  version: 2,
  prompt: 'Draw a pelican.',
  targets: [{ group: 'public', models: ['model-0'] }],
  enabled: false,
  schedule_mode: 'interval',
  interval_hours: 24,
  daily_time: '09:00',
  timezone: 'Asia/Shanghai',
  next_run_at: 0,
  updated_at: 1,
  updated_by: 1,
}
const originalAdapter = api.defaults.adapter
let client: QueryClient
let saved: IQConfigInput[]
let conflict: boolean

beforeEach(() => {
  client = new QueryClient()
  saved = []
  conflict = false
  useAuthStore.getState().auth.setBundle({
    access_token: 'fixture-token',
    token_type: 'Bearer',
    access_expires_at: 4_000_000_000,
    user: { id: 1, username: 'admin', role: 100, group: 'public' },
    session: {
      sid: 'settings-session',
      current: true,
      login_method: 'password',
      ip: '',
      user_agent: '',
      created_at: 1,
      last_active_at: 1,
      expires_at: 4_000_000_000,
    },
  })
  const adapter: AxiosAdapter = async (request) => {
    if (request.url !== '/api/iq-tests/config') {
      throw new Error('Unexpected API request')
    }
    const response = {
      status: 200,
      statusText: 'OK',
      headers: {},
      config: request,
      data: { success: true, message: '', data: { ...config, version: 3 } },
    }
    if (request.method === 'put') {
      const input = JSON.parse(request.data) as IQConfigInput
      saved.push(input)
      if (conflict) {
        throw new AxiosError(
          'Conflict',
          'ERR_BAD_REQUEST',
          request,
          undefined,
          { ...response, status: 409 }
        )
      }
      response.data.data = { ...config, ...input, version: 3 }
    }
    return response
  }
  api.defaults.adapter = adapter
})

afterEach(() => {
  client.clear()
  api.defaults.adapter = originalAdapter
  useAuthStore.getState().auth.reset()
})

function SettingsFixture() {
  const scope = useIQViewerScope()
  if (!scope) return null
  return (
    <IQConfigForm
      scope={scope}
      config={config}
      catalog={[{ group: 'public', models: ['model-0', 'model-1'] }]}
      canWrite
    />
  )
}
function mount() {
  render(
    <QueryClientProvider client={client}>
      <SettingsFixture />
    </QueryClientProvider>
  )
}

describe('IQ configuration editing', () => {
  it('round-trips exact prompt, model checkboxes, enable toggle and daily Beijing schedule without server fields', async () => {
    const user = userEvent.setup()
    mount()
    await user.clear(screen.getByLabelText('Test prompt'))
    await user.type(
      screen.getByLabelText('Test prompt'),
      '  Finished artwork.  '
    )
    await user.click(screen.getByRole('checkbox', { name: 'model-1' }))
    await user.click(screen.getByRole('switch', { name: 'Enable schedule' }))
    await user.selectOptions(screen.getByLabelText('Schedule'), 'daily')
    expect(screen.queryByLabelText('Interval (hours)')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Daily time (Beijing)')).toHaveValue('09:00')
    fireEvent.change(screen.getByLabelText('Daily time (Beijing)'), {
      target: { value: '23:30' },
    })
    await user.selectOptions(screen.getByLabelText('Schedule'), 'interval')
    expect(screen.getByLabelText('Interval (hours)')).toHaveValue(24)
    await user.selectOptions(screen.getByLabelText('Schedule'), 'daily')
    expect(screen.getByLabelText('Daily time (Beijing)')).toHaveValue('23:30')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]).toEqual({
      version: 2,
      prompt: '  Finished artwork.  ',
      targets: [{ group: 'public', models: ['model-0', 'model-1'] }],
      enabled: true,
      schedule_mode: 'daily',
      interval_hours: 24,
      daily_time: '23:30',
      timezone: 'Asia/Shanghai',
    })
    expect(
      iqConfigSchema.safeParse({ ...saved[0], enabled: true, targets: [] })
        .success
    ).toBe(false)
  })

  it('preserves edits on 409, blocks stale resubmission, and reloads only on explicit discard', async () => {
    conflict = true
    const user = userEvent.setup()
    mount()
    await user.type(screen.getByLabelText('Test prompt'), ' Extra detail.')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')
    expect(screen.getByLabelText('Test prompt')).toHaveValue(
      'Draw a pelican. Extra detail.'
    )
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(saved).toHaveLength(1)
    await user.click(
      screen.getByRole('button', {
        name: 'Reload configuration (discard edits)',
      })
    )
    await waitFor(() =>
      expect(screen.getByLabelText('Test prompt')).toHaveValue(
        'Draw a pelican.'
      )
    )
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })
})
