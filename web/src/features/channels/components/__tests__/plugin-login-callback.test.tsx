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
import { StrictMode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { PLUGIN_LOGIN_BROADCAST_CHANNEL } from '../../lib/plugin-login'
import { PluginLoginCallback } from '../plugin-login-callback'

const originalAuth = useAuthStore.getState().auth
let listener: BroadcastChannel

beforeEach(() => {
  useAuthStore.setState({
    auth: {
      ...originalAuth,
      user: { id: 1, username: 'root', role: ROLE.SUPER_ADMIN },
    },
  })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/task_plugin_options') {
      return {
        data: {
          success: true,
          data: [{ key: 'acct', name: 'Account Plugin', models: [] }],
        },
      }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
  window.history.replaceState(
    null,
    '',
    '/oauth/plugin/acct/callback?code=abc&state=xyz&iss=https%3A%2F%2Fvendor.example'
  )
  listener = new BroadcastChannel(PLUGIN_LOGIN_BROADCAST_CHANNEL)
})

afterEach(() => {
  listener.close()
  useAuthStore.setState({ auth: originalAuth })
  window.history.replaceState(null, '', '/')
})

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <PluginLoginCallback pluginKey='acct' />
      </QueryClientProvider>
    </StrictMode>
  )
}

test('the callback hides the query, sends it once and tells the login dialog', async () => {
  const step = {
    type: 'done',
    credential: { index: 0, label: 'user@example.com', expires_at: 0 },
  }
  const post = vi.spyOn(api, 'post').mockResolvedValue({
    data: { success: true, data: { channel_id: 7, step } },
  })
  const messages: unknown[] = []
  listener.addEventListener('message', (event) => messages.push(event.data))

  renderPage()

  expect(window.location.search).toBe('')
  expect(window.location.pathname).toBe('/oauth/plugin/acct/callback')
  expect(await screen.findByText('Logged in')).toBeVisible()
  expect(screen.getByText('user@example.com')).toBeVisible()
  expect(screen.getByText('You can close this tab.')).toBeVisible()
  expect(
    await screen.findByText('Log in to Account Plugin')
  ).toBeInTheDocument()
  expect(post).toHaveBeenCalledTimes(1)
  expect(post).toHaveBeenCalledWith(
    '/api/channel/plugin_login/callback',
    {
      plugin: 'acct',
      params: { code: 'abc', state: 'xyz', iss: 'https://vendor.example' },
    },
    expect.anything()
  )
  await waitFor(() => expect(messages).toEqual([{ channel_id: 7, step }]))
})

test('a rejected callback shows the error and tells the dialog of its flow', async () => {
  vi.spyOn(api, 'post').mockResolvedValue({
    data: { success: false, message: 'The sign-in request has expired' },
  })
  const messages: unknown[] = []
  listener.addEventListener('message', (event) => messages.push(event.data))

  renderPage()

  expect(
    await screen.findByText('The sign-in request has expired')
  ).toBeVisible()
  expect(
    screen.getByText('Close this tab and try again from the login dialog.')
  ).toBeVisible()
  expect(window.location.search).toBe('')
  await waitFor(() =>
    expect(messages).toEqual([
      { state: 'xyz', error: 'The sign-in request has expired' },
    ])
  )
})
