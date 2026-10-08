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
  createRouter,
  createRootRoute,
  createMemoryHistory,
  RouterContextProvider,
} from '@tanstack/react-router'
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
import { afterEach, assert, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import {
  CHANNEL_TYPE_VLLM,
  CHANNEL_TYPE_SGLANG,
  CHANNEL_TYPE_TENSORFOLD,
} from '../../constants'
import type {
  InferenceProvider,
  InferenceStatus,
} from '../../lib/inference-status'
import { channelSchema } from '../../types'
import { ChannelRowActionsLayoutContext } from '../channel-row-actions-context'
import { BalanceCell } from '../channels-columns'
import { ChannelsDialogs } from '../channels-dialogs'
import { ChannelsProvider } from '../channels-provider'
import { InferenceStatusDialog } from '../dialogs/inference-status-dialog'
import { ChannelMutateDrawer } from '../drawers/channel-mutate-drawer'

const originalAuth = useAuthStore.getState().auth
let client: QueryClient

function fixture(): InferenceStatus {
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
  },
  provider: InferenceProvider = 'vllm'
) {
  return (
    <QueryClientProvider client={client}>
      <InferenceStatusDialog
        provider={provider}
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
  {
    layout: 'table' as const,
    action: 'click',
    provider: 'vllm',
    name: 'vLLM',
    type: CHANNEL_TYPE_VLLM,
  },
  {
    layout: 'table' as const,
    action: 'click',
    provider: 'sglang',
    name: 'SGLang',
    type: CHANNEL_TYPE_SGLANG,
  },
  {
    layout: 'card' as const,
    action: 'Enter',
    provider: 'vllm',
    name: 'vLLM',
    type: CHANNEL_TYPE_VLLM,
  },
  {
    layout: 'card' as const,
    action: ' ',
    provider: 'sglang',
    name: 'SGLang',
    type: CHANNEL_TYPE_SGLANG,
  },
  {
    layout: 'table' as const,
    action: 'click',
    provider: 'tensorfold',
    name: 'TensorFold',
    type: CHANNEL_TYPE_TENSORFOLD,
  },
  {
    layout: 'card' as const,
    action: 'Enter',
    provider: 'tensorfold',
    name: 'TensorFold',
    type: CHANNEL_TYPE_TENSORFOLD,
  },
])(
  'opens $name status from the balance cell in $layout view using $action',
  async ({ layout, action, provider, name, type }) => {
    const get = vi.spyOn(api, 'get').mockImplementation(async (url) => {
      if (url === `/api/channel/42/${provider}/status`) {
        return { data: { success: true, data: fixture() } }
      }
      return { data: { success: true, data: [] } }
    })
    const channel = channelSchema.parse({
      id: 42,
      type,
      key: '',
      name: `Test ${name}`,
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
    const entry = screen.getByRole('button', { name: `${name} status` })
    expect(entry).toHaveAttribute('aria-haspopup', 'dialog')
    if (action === 'click') {
      await user.click(entry)
    } else {
      entry.focus()
      await user.keyboard(action === 'Enter' ? '{Enter}' : ' ')
    }
    expect(
      await screen.findByRole('dialog', { name: `${name} status` })
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
  { language: 'en', locale: 'en' },
  { language: 'fr', locale: 'fr' },
  { language: 'ru', locale: 'ru' },
  { language: 'ja', locale: 'ja' },
  { language: 'vi', locale: 'vi' },
  { language: 'not_a_locale', locale: undefined },
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
      await screen.findByText(
        `Max context tokens: ${new Intl.NumberFormat(locale).format(1048576)}`,
        { collapseWhitespace: false }
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        `Last updated: ${new Date(data.sampled_at).toLocaleString(locale)}`,
        { collapseWhitespace: false }
      )
    ).toBeInTheDocument()
    await act(async () => {
      await i18n.changeLanguage('en')
    })
    expect(
      screen.getByText('Max context tokens: 1,048,576')
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

it.each(['vllm', 'tensorfold'] as const)(
  'keeps $0 model information when metrics are unavailable',
  async (provider) => {
    const data = provider === 'tensorfold' ? tensorFoldFixture() : fixture()
    data.endpoints['/metrics'] = { status: 404, error: 'http_error' }
    data.metrics = []
    vi.spyOn(api, 'get').mockResolvedValue({ data: { success: true, data } })
    render(panel(42, undefined, provider))
    expect(await screen.findByText('served-model')).toBeInTheDocument()
    expect(screen.getByText('Unavailable · HTTP 404')).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'Current load' })).getAllByText(
        'Unavailable'
      )
    ).toHaveLength(4)
  }
)

it.each([
  { provider: 'vllm' as const, name: 'vLLM' },
  { provider: 'tensorfold' as const, name: 'TensorFold' },
])(
  'shows $name errors, retries and preserves the snapshot after a failed refresh',
  async ({ provider, name }) => {
    const get = vi
      .spyOn(api, 'get')
      .mockRejectedValueOnce(new Error('Connection unavailable'))
    const user = userEvent.setup()
    render(panel(42, undefined, provider))
    expect(
      await screen.findByText(`Failed to load ${name} status`)
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
  }
)

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
  let finish!: (value: {
    data: { success: boolean; data: InferenceStatus }
  }) => void
  let firstSignal: AbortSignal | undefined
  const pending = new Promise<{
    data: { success: boolean; data: InferenceStatus }
  }>((resolve) => {
    finish = resolve
  })
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

it.each(['vllm', 'tensorfold'] as const)(
  'disables $0 mutations and tests for a read-only operator',
  async (provider) => {
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
    render(panel(42, undefined, provider))
    await screen.findByText('served-model')
    expect(screen.getByRole('button', { name: 'Sync models' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Test Connection' })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled()
  }
)

function tensorFoldFixture(): InferenceStatus {
  return {
    ...fixture(),
    version: '',
    endpoints: {
      '/health': { status: 200 },
      '/v1/models': { status: 200 },
      '/metrics': { status: 200 },
    },
    metrics: [
      { name: 'tensorfold:requests_running', labels: {}, value: 0 },
      { name: 'tensorfold:num_requests_running', labels: {}, value: 0 },
      { name: 'tensorfold:requests_waiting', labels: {}, value: 2 },
      { name: 'tensorfold:num_requests_waiting', labels: {}, value: 2 },
      {
        name: 'tensorfold:kv_cache_usage_ratio',
        labels: { pool: '0' },
        value: 0.25,
      },
      {
        name: 'tensorfold:kv_cache_usage_ratio',
        labels: { pool: '1' },
        value: 0.5,
      },
      {
        name: 'tensorfold:kv_cache_usage_perc',
        labels: { stream: '0' },
        value: 0.25,
      },
      {
        name: 'tensorfold:kv_cache_usage_perc',
        labels: { stream: '1' },
        value: 0.5,
      },
      {
        name: 'tensorfold:requests_total',
        labels: { status: '200' },
        value: 4,
      },
      {
        name: 'tensorfold:requests_total',
        labels: { status: '500' },
        value: 1,
      },
      { name: 'tensorfold:prompt_tokens_total', labels: {}, value: 100 },
      { name: 'tensorfold:generation_tokens_total', labels: {}, value: 40 },
      { name: 'tensorfold:generation_tokens_running', labels: {}, value: 7 },
      { name: 'tensorfold:mtp_accepted_total', labels: {}, value: 3 },
      { name: 'tensorfold:mtp_drafted_total', labels: {}, value: 4 },
      { name: 'tensorfold:request_latency_seconds_sum', labels: {}, value: 6 },
      {
        name: 'tensorfold:request_latency_seconds_count',
        labels: {},
        value: 2,
      },
      { name: 'tensorfold:request_prefill_seconds_sum', labels: {}, value: 1 },
      {
        name: 'tensorfold:request_prefill_seconds_count',
        labels: {},
        value: 2,
      },
    ],
  }
}

it('shows native TensorFold metrics without double-counting aliases or inventing missing values', async () => {
  const data = tensorFoldFixture()
  vi.spyOn(api, 'get').mockResolvedValue({ data: { success: true, data } })
  render(panel(64, undefined, 'tensorfold'))
  await screen.findByText('served-model')
  const load = within(screen.getByRole('region', { name: 'Current load' }))
  expect(
    load.getByText('Running requests').nextElementSibling
  ).toHaveTextContent(/^0$/)
  expect(
    load.getByText('Waiting requests').nextElementSibling
  ).toHaveTextContent(/^2$/)
  expect(
    load.getByText('Peak KV cache usage').nextElementSibling
  ).toHaveTextContent('50%')
  expect(
    load.getByText('Live output tokens').nextElementSibling
  ).toHaveTextContent(/^7$/)
  const usage = within(screen.getByRole('region', { name: 'Cumulative usage' }))
  expect(
    usage.getByText('HTTP responses').nextElementSibling
  ).toHaveTextContent(/^5$/)
  expect(usage.getByText('Output tokens').nextElementSibling).toHaveTextContent(
    /^40$/
  )
  expect(
    usage.getByText('Speculative decoding acceptance rate').nextElementSibling
  ).toHaveTextContent('75%')
  expect(
    usage.getByText('Mean request latency').nextElementSibling
  ).toHaveTextContent('3 sec')
  expect(
    usage.getByText('Mean prefill time').nextElementSibling
  ).toHaveTextContent('0.5 sec')
  expect(
    usage.getByText('Mean time to first token').nextElementSibling
  ).toHaveTextContent('Unavailable')
  expect(screen.queryByText('Awake engines')).not.toBeInTheDocument()
  expect(screen.queryByText('Prefix cache hit rate')).not.toBeInTheDocument()
  expect(screen.queryByText('Mean queue time')).not.toBeInTheDocument()
  expect(screen.queryByText('/version')).not.toBeInTheDocument()
  const recent = within(
    screen.getByRole('region', { name: 'Since previous sample' })
  )
  expect(
    recent.getByText('Output token rate').nextElementSibling
  ).toHaveTextContent('Unavailable')
})

it('computes TensorFold output rates from finished tokens and resets the window after a counter reset', async () => {
  const data = tensorFoldFixture()
  const get = vi
    .spyOn(api, 'get')
    .mockResolvedValue({ data: { success: true, data } })
  const user = userEvent.setup()
  render(panel(64, undefined, 'tensorfold'))
  await screen.findByText('served-model')
  const recent = within(
    screen.getByRole('region', { name: 'Since previous sample' })
  )
  const second = {
    ...data,
    sampled_at: 6000,
    metrics: data.metrics.map((metric) => {
      if (metric.name === 'tensorfold:generation_tokens_total') {
        return { ...metric, value: 60 }
      }
      if (metric.name === 'tensorfold:generation_tokens_running') {
        return { ...metric, value: 0 }
      }
      return metric
    }),
  }
  get.mockResolvedValue({ data: { success: true, data: second } })
  await user.click(screen.getByRole('button', { name: 'Refresh' }))
  await waitFor(() =>
    expect(
      recent.getByText('Output token rate').nextElementSibling
    ).toHaveTextContent('4 tokens/s')
  )
  get.mockResolvedValue({
    data: { success: true, data: { ...data, sampled_at: 11000 } },
  })
  await user.click(screen.getByRole('button', { name: 'Refresh' }))
  await waitFor(() =>
    expect(
      recent.getByText('Output token rate').nextElementSibling
    ).toHaveTextContent('Unavailable')
  )
})

it('keeps SGLang worker values separate and wraps long labels below them', async () => {
  const data = fixture()
  const workerLabels = {
    engine_type: 'unified',
    model_name: 'deepseek-v4.1-flash',
    moe_ep_rank: '0',
    pp_rank: '0',
    tp_rank: '0',
  }
  data.version = '0.5.19'
  data.endpoints = {
    '/health': { status: 200 },
    '/server_info': { status: 200 },
    '/v1/models': { status: 200 },
    '/metrics': { status: 200 },
  }
  data.metrics = [
    { name: 'sglang:num_running_reqs', labels: {}, value: 3 },
    { name: 'sglang:num_queue_reqs', labels: {}, value: 0 },
    { name: 'sglang:token_usage', labels: { dp_rank: '0' }, value: 0.25 },
    { name: 'sglang:token_usage', labels: { dp_rank: '1' }, value: 0.5 },
    { name: 'sglang:cache_hit_rate', labels: workerLabels, value: 0.2 },
    { name: 'sglang:cache_hit_rate', labels: { dp_rank: '1' }, value: 0.8 },
    { name: 'sglang:spec_accept_rate', labels: workerLabels, value: 0.99 },
    { name: 'sglang:inter_token_latency_seconds_sum', labels: {}, value: 4 },
    {
      name: 'sglang:inter_token_latency_seconds_count',
      labels: {},
      value: 2,
    },
  ]
  const get = vi
    .spyOn(api, 'get')
    .mockResolvedValue({ data: { success: true, data } })
  render(
    <QueryClientProvider client={client}>
      <InferenceStatusDialog
        provider='sglang'
        channelId={63}
        channelName='SGLang'
        onClose={vi.fn()}
        onSyncModels={vi.fn()}
        onTestChannel={vi.fn()}
      />
    </QueryClientProvider>
  )
  expect(await screen.findByText('0.5.19')).toBeInTheDocument()
  const load = within(screen.getByRole('region', { name: 'Current load' }))
  expect(load.getByText('3')).toBeInTheDocument()
  expect(load.getByText('0')).toBeInTheDocument()
  expect(load.getByText('50%')).toBeInTheDocument()
  expect(
    within(screen.getByRole('region', { name: 'Cumulative usage' })).getByText(
      '2 sec'
    )
  ).toBeInTheDocument()
  const workers = within(screen.getByRole('region', { name: 'Worker metrics' }))
  expect(workers.getByText('20%')).toBeInTheDocument()
  expect(workers.getByText('80%')).toBeInTheDocument()
  expect(workers.getByText('99%')).toBeInTheDocument()
  const workerCard = workers.getByText('20%').parentElement
  assert(workerCard)
  expect(within(workerCard).getByRole('term')).toHaveTextContent(
    /^Prefix cache hit rate$/
  )
  expect(workerCard).toHaveClass('min-w-0')
  const labels = within(workerCard).getByText(JSON.stringify(workerLabels))
  expect(labels).toHaveClass('col-span-2', 'break-all')
  expect(screen.queryByText('Awake engines')).not.toBeInTheDocument()
  expect(get).toHaveBeenCalledWith(
    '/api/channel/63/sglang/status',
    expect.objectContaining({ signal: expect.any(AbortSignal) })
  )
  get.mockResolvedValue({
    data: {
      success: true,
      data: {
        ...data,
        endpoints: {
          ...data.endpoints,
          '/metrics': { status: 404, error: 'http_error' },
        },
        metrics: [],
      },
    },
  })
  await userEvent.setup().click(screen.getByRole('button', { name: 'Refresh' }))
  expect(
    await screen.findByText(
      'Start SGLang with --enable-metrics to expose Prometheus metrics.'
    )
  ).toBeInTheDocument()
  expect(screen.getByText('served-model')).toBeInTheDocument()
})

it.each([
  { type: CHANNEL_TYPE_VLLM, editable: false },
  { type: CHANNEL_TYPE_SGLANG, editable: false },
  { type: 58, editable: true },
])(
  'limits the route editor to advanced custom channels: type $type',
  async ({ type, editable }) => {
    const channel = channelSchema.parse({
      id: 42,
      type,
      key: '',
      name: 'Inference',
      base_url: 'https://inference.example',
      models: 'served-model',
      status: 1,
      created_time: 1,
      test_time: 0,
      response_time: 0,
      balance_updated_time: 0,
      settings:
        '{"advanced_custom":{"advanced_routes":[{"incoming_path":"/v1/chat/completions","upstream_path":"/v1/chat/completions","converter":"none"}]}}',
    })
    vi.spyOn(api, 'get').mockImplementation(async (url) => ({
      data: { success: true, data: url === '/api/channel/42' ? channel : [] },
    }))
    const router = createRouter({
      routeTree: createRootRoute(),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
    render(
      <QueryClientProvider client={client}>
        <RouterContextProvider router={router}>
          <ChannelsProvider>
            <ChannelMutateDrawer
              open
              onOpenChange={vi.fn()}
              currentRow={channel}
            />
          </ChannelsProvider>
        </RouterContextProvider>
      </QueryClientProvider>
    )
    expect(await screen.findByDisplayValue('Inference')).toBeInTheDocument()
    expect(
      Boolean(screen.queryByRole('button', { name: 'Configure routes' }))
    ).toBe(editable)
  }
)
