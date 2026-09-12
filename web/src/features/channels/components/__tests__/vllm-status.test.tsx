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
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { CHANNEL_TYPE_VLLM } from '../../constants'
import type { VLLMStatus } from '../../lib/vllm-status'
import { channelSchema } from '../../types'
import { ChannelRowActionsLayoutContext } from '../channel-row-actions-context'
import { BalanceCell } from '../channels-columns'
import { ChannelsDialogs } from '../channels-dialogs'
import { ChannelsProvider } from '../channels-provider'
import { VLLMStatusDialog } from '../dialogs/vllm-status-dialog'

const originalAuth = useAuthStore.getState().auth
let client: QueryClient

function fixture(): VLLMStatus {
  return {
    sampled_at: 1000,
    endpoints: {
      '/health': { status: 200 },
      '/version': { status: 200 },
      '/v1/models': { status: 200 },
      '/metrics': { status: 200 },
    },
    version: '0.25.2-test',
    models: [
      { id: 'served-model', root: 'source/model', max_model_len: 1048576 },
    ],
    metrics: [
      { name: 'vllm:num_requests_running', labels: {}, value: 0 },
      { name: 'vllm:num_requests_waiting', labels: {}, value: 2 },
    ],
    raw_metrics: 'vllm:num_requests_running 0\n',
  }
}

function panel(
  channelId = 42,
  callbacks = {
    onClose: vi.fn(),
    onSyncModels: vi.fn(),
    onTestChannel: vi.fn(),
  }
) {
  return (
    <QueryClientProvider client={client}>
      <VLLMStatusDialog
        key={channelId}
        channelId={channelId}
        channelName='Test vLLM'
        {...callbacks}
      />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useAuthStore.setState({
    auth: {
      ...originalAuth,
      user: { id: 1, username: 'root', role: ROLE.SUPER_ADMIN },
    },
  })
})

afterEach(() => {
  cleanup()
  client.clear()
  vi.useRealTimers()
  vi.restoreAllMocks()
  useAuthStore.setState({ auth: originalAuth })
})

it.each([
  { layout: 'table' as const, action: 'click' },
  { layout: 'card' as const, action: 'Enter' },
  { layout: 'card' as const, action: ' ' },
])(
  'opens vLLM status from the balance cell in $layout view using $action',
  async ({ layout, action }) => {
    const get = vi.spyOn(api, 'get').mockImplementation(async (url) => {
      if (url === '/api/channel/42/vllm/status') {
        return { data: { success: true, data: fixture() } }
      }
      return { data: { success: true, data: [] } }
    })
    const channel = channelSchema.parse({
      id: 42,
      type: CHANNEL_TYPE_VLLM,
      key: '',
      name: 'Test vLLM',
      status: 1,
      created_time: 1,
      test_time: 0,
      response_time: 0,
      balance_updated_time: 0,
    })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={client}>
        <ChannelsProvider>
          <ChannelRowActionsLayoutContext.Provider value={layout}>
            <BalanceCell channel={channel} />
          </ChannelRowActionsLayoutContext.Provider>
          <ChannelsDialogs />
        </ChannelsProvider>
      </QueryClientProvider>
    )
    const entry = screen.getByRole('button', { name: 'vLLM status' })
    expect(entry).toHaveAttribute('aria-haspopup', 'dialog')
    if (action === 'click') {
      await user.click(entry)
    } else {
      entry.focus()
      await user.keyboard(action === 'Enter' ? '{Enter}' : ' ')
    }
    expect(
      await screen.findByRole('dialog', { name: 'vLLM status' })
    ).toBeInTheDocument()
    expect(await screen.findByText('served-model')).toBeInTheDocument()
    expect(get.mock.calls.some(([url]) => url.includes('update_balance'))).toBe(
      false
    )
  }
)

it.each([
  { language: 'zhCN', locale: 'zh-CN' },
  { language: 'zhTW', locale: 'zh-TW' },
])(
  'formats status numbers and timestamps for $language',
  async ({ language, locale }) => {
    const i18n = createInstance()
    await i18n.init({
      lng: language,
      resources: {
        [language]: { translation: { 'vLLM status': 'vLLM status' } },
      },
    })
    const data = fixture()
    vi.spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data },
    })

    render(<I18nextProvider i18n={i18n}>{panel()}</I18nextProvider>)

    expect(
      await screen.findByText('Max context tokens: 1,048,576')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        `Last updated: ${new Date(data.sampled_at).toLocaleString(locale)}`,
        { collapseWhitespace: false }
      )
    ).toBeInTheDocument()
  }
)

it('shows zero load, unavailable optional metrics, model details and existing channel actions', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: fixture() },
  })
  const callbacks = {
    onClose: vi.fn(),
    onSyncModels: vi.fn(),
    onTestChannel: vi.fn(),
  }
  const user = userEvent.setup()
  render(panel(42, callbacks))
  expect(screen.getByRole('button', { name: 'Export snapshot' })).toBeDisabled()
  expect(await screen.findByText('served-model')).toBeInTheDocument()
  expect(screen.getByText('Max context tokens: 1,048,576')).toBeInTheDocument()
  const load = within(screen.getByRole('region', { name: 'Current load' }))
  expect(load.getByText('0')).toBeInTheDocument()
  expect(load.getByText('2')).toBeInTheDocument()
  expect(load.getAllByText('Unavailable')).toHaveLength(2)
  expect(screen.getByRole('button', { name: 'Export snapshot' })).toBeEnabled()
  await user.click(screen.getByRole('button', { name: 'Sync models' }))
  expect(callbacks.onSyncModels).toHaveBeenCalledOnce()
  await user.click(screen.getByRole('button', { name: 'Test Connection' }))
  expect(callbacks.onTestChannel).toHaveBeenCalledOnce()
  await user.keyboard('{Escape}')
  expect(callbacks.onClose).toHaveBeenCalledOnce()
})

it('keeps healthy model information when metrics are unavailable', async () => {
  const data = fixture()
  data.endpoints['/metrics'] = { status: 404, error: 'http_error' }
  data.metrics = []
  vi.spyOn(api, 'get').mockResolvedValue({ data: { success: true, data } })
  render(panel())
  expect(await screen.findByText('served-model')).toBeInTheDocument()
  expect(screen.getByText('Unavailable · HTTP 404')).toBeInTheDocument()
  expect(
    within(screen.getByRole('region', { name: 'Current load' })).getAllByText(
      'Unavailable'
    )
  ).toHaveLength(4)
})

it('shows errors, retries on demand and labels preserved data after a failed refresh', async () => {
  const get = vi
    .spyOn(api, 'get')
    .mockRejectedValueOnce(new Error('Connection unavailable'))
  const user = userEvent.setup()
  render(panel())
  expect(
    await screen.findByText('Failed to load vLLM status')
  ).toBeInTheDocument()
  expect(screen.getByText('Connection unavailable')).toBeInTheDocument()
  get.mockResolvedValueOnce({ data: { success: true, data: fixture() } })
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByText('served-model')).toBeInTheDocument()
  get.mockRejectedValueOnce(new Error('Connection unavailable'))
  await user.click(screen.getByRole('button', { name: 'Refresh' }))
  expect(
    await screen.findByText(
      'Refresh failed. Showing the last successful snapshot.'
    )
  ).toBeInTheDocument()
  expect(screen.getByText('served-model')).toBeInTheDocument()
})

it('polls while enabled and stops after disabling auto refresh or closing the panel', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  let sampledAt = 1000
  const get = vi.spyOn(api, 'get').mockImplementation(async () => {
    const data = fixture()
    data.sampled_at = sampledAt
    sampledAt += 5000
    return { data: { success: true, data } }
  })
  const user = userEvent.setup()
  const view = render(panel())
  await screen.findByText('served-model')
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000)
  })
  await screen.findByText('Sample interval: 5 seconds')
  await user.click(screen.getByRole('switch', { name: 'Auto refresh (5s)' }))
  const count = get.mock.calls.length
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000)
  })
  expect(get).toHaveBeenCalledTimes(count)
  await user.click(screen.getByRole('switch', { name: 'Auto refresh (5s)' }))
  view.unmount()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000)
  })
  expect(get).toHaveBeenCalledTimes(count)
})

it('cancels requests on channel changes and ignores late results from the previous channel', async () => {
  let finish!: (value: { data: { success: boolean; data: VLLMStatus } }) => void
  let firstSignal: AbortSignal | undefined
  const pending = new Promise<{ data: { success: boolean; data: VLLMStatus } }>(
    (resolve) => {
      finish = resolve
    }
  )
  vi.spyOn(api, 'get').mockImplementation((url, config) => {
    if (url === '/api/channel/42/vllm/status') {
      firstSignal = config?.signal as AbortSignal
      return pending
    }
    const data = fixture()
    data.version = 'channel-43-version'
    return Promise.resolve({ data: { success: true, data } })
  })
  const view = render(panel())
  await waitFor(() => expect(firstSignal).toBeDefined())
  view.rerender(panel(43))
  expect(firstSignal?.aborted).toBe(true)
  await screen.findByText('channel-43-version')
  await act(async () => {
    finish({ data: { success: true, data: fixture() } })
    await pending
  })
  expect(screen.queryByText('0.25.2-test')).not.toBeInTheDocument()
})

it('disables channel mutations and tests for a read-only operator', async () => {
  useAuthStore.setState({
    auth: {
      ...originalAuth,
      user: {
        id: 2,
        username: 'reader',
        role: ROLE.ADMIN,
        permissions: { admin_permissions: { channel: { read: true } } },
      },
    },
  })
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: fixture() },
  })
  render(panel())
  await screen.findByText('served-model')
  expect(screen.getByRole('button', { name: 'Sync models' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Test Connection' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled()
})
