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
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TerminalHome } from '@/features/dashboard/components/overview/terminal-home'
import { api } from '@/lib/api'
import { useSystemConfigStore } from '@/stores/system-config-store'
import { renderApp } from '@/test-utils/render-app'

import { TerminalReports } from '../terminal-reports'
import { TerminalRequests } from '../terminal-requests'

const originalAdapter = api.defaults.adapter
const originalConfig = useSystemConfigStore.getState().config
let client: QueryClient
let summaryFails = false
let requestedWindow = 0
let requestedStart = 0
let summaryRequests = 0
let listWindow = 0
let requestedLogTypeSets: string[] = []
let includeStandaloneError = false
let requestOther: Record<string, unknown> = {}
let requestType = 2
let streamFails = true
const requestCreatedAt = Date.UTC(2026, 8, 8, 12, 34) / 1000
const summary = {
  requests: 103,
  succeeded: 101,
  failed: 2,
  quota: 500000,
  tokens: 510,
  saved_quota: 250000,
  comparable_requests: 101,
  daily: [
    {
      date: '2026-09-08',
      requests: 101,
      succeeded: 100,
      failed: 1,
      quota: 400000,
      tokens: 500,
      saved_quota: 250000,
      comparable_requests: 100,
    },
    {
      date: '2026-09-07',
      requests: 2,
      succeeded: 1,
      failed: 1,
      quota: 100000,
      tokens: 10,
      saved_quota: 0,
      comparable_requests: 1,
    },
  ],
}

beforeEach(() => {
  summaryFails = false
  requestedWindow = 0
  summaryRequests = 0
  listWindow = 0
  requestedLogTypeSets = []
  includeStandaloneError = false
  requestOther = { group_ratio: 0.5 }
  requestType = 2
  streamFails = true
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  client.setQueryData(['status'], {}, { updatedAt: Date.now() + 60000 })
  client.setQueryData(
    ['pricing'],
    { data: [], vendors: [] },
    { updatedAt: Date.now() + 60000 }
  )
  useSystemConfigStore.setState({
    config: {
      ...originalConfig,
      currency: {
        ...originalConfig.currency,
        quotaPerUnit: 500000,
        quotaDisplayType: 'CNY',
        usdExchangeRate: 7,
      },
    },
  })
  api.defaults.adapter = async (config) => {
    const url = new URL(config.url ?? '', 'http://localhost')
    let data: unknown
    if (url.pathname === '/api/log/self/summary') {
      summaryRequests++
      requestedStart = Number(config.params.start_timestamp)
      requestedWindow =
        Number(config.params.end_timestamp) -
        Number(config.params.start_timestamp) +
        1
      data = summaryFails
        ? { success: false, message: 'Report unavailable' }
        : { success: true, data: summary }
    } else if (url.pathname === '/api/token/') {
      data = { success: true, data: { items: [] } }
    } else if (url.pathname === '/api/log/self') {
      listWindow =
        Number(url.searchParams.get('end_timestamp')) -
        Number(url.searchParams.get('start_timestamp')) +
        1
      const page = Number(url.searchParams.get('p') ?? 1)
      const pageSize = Number(url.searchParams.get('page_size') ?? 50)
      const typeParam = url.searchParams.get('type')
      const typesParam = url.searchParams.get('types')
      const requestedType = Number(typeParam ?? 0)
      if (typesParam !== null) requestedLogTypeSets.push(typesParam)
      const requestLogs = Array.from({ length: 51 }, (_, index) => {
        let modelName = `request-${index + 1}`
        if (index === 0) modelName = 'partial-stream'
        else if (index === 50) modelName = 'older-request'
        return {
          id: index + 1,
          user_id: 1,
          created_at: requestCreatedAt,
          type: requestType,
          content: '',
          token_name: 'work-key',
          request_id: index === 0 ? 'request-001' : `request-${index + 1}`,
          model_name: modelName,
          quota: 100000,
          prompt_tokens: 4,
          completion_tokens: 1,
          use_time: 4,
          is_stream: true,
          other: JSON.stringify({
            stream_status: {
              status: streamFails ? 'error' : 'ok',
              end_error: streamFails ? 'upstream timeout' : undefined,
            },
            ...requestOther,
          }),
        }
      })
      if (
        includeStandaloneError &&
        (requestedType === 5 || typesParam?.split(',').includes('5'))
      ) {
        requestLogs.unshift({
          ...requestLogs[0],
          id: 1,
          created_at: requestCreatedAt + 1,
          type: 5,
          request_id: 'standalone-error',
          model_name: 'standalone-error',
        })
      }
      const requestedTypes = new Set(
        typesParam?.split(',').map((value) => Number(value)) ?? []
      )
      let matchingLogs = requestLogs
      if (typesParam) {
        matchingLogs = requestLogs.filter((log) => requestedTypes.has(log.type))
      } else if (typeParam !== null) {
        matchingLogs = requestLogs.filter((log) => log.type === requestedType)
      }
      data = {
        success: true,
        data: {
          page,
          page_size: pageSize,
          total: typesParam || typeParam === null ? 103 : matchingLogs.length,
          items: matchingLogs.slice((page - 1) * pageSize, page * pageSize),
        },
      }
    } else throw new Error(`Unexpected request ${url.pathname}`)
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  api.defaults.adapter = originalAdapter
  client.clear()
  useSystemConfigStore.setState({ config: originalConfig })
})

describe('terminal usage views', () => {
  it('shows complete totals separately from a paginated request history', async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={client}>
        <TerminalRequests />
      </QueryClientProvider>
    )
    await screen.findByText('partial-stream')
    expect(
      screen.getByText('Requests today').closest('article')
    ).toHaveTextContent('103')
    expect(screen.queryByText('Successful requests')).not.toBeInTheDocument()
    expect(
      screen.getByText('Failed requests').closest('article')
    ).toHaveTextContent('2')
    expect(
      screen.getByText('Usage today').closest('article')
    ).toHaveTextContent('¥7')
    expect(requestedWindow).toBe(86400)
    expect(listWindow).toBe(86400)
    expect(requestedLogTypeSets).toEqual(['2,5'])
    expect(screen.queryByText('Successful + failed requests')).toBeNull()
    expect(
      screen.queryByText(
        'Before-discount amounts are estimates. Charges may apply even if a request fails or is interrupted.'
      )
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Finished normally')).toBeNull()
    expect(
      screen.queryByText('Includes interrupted responses; charges may apply.')
    ).toBeNull()
    expect(
      screen.queryByText('Billed usage today, including subscription usage.')
    ).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('older-request')).toBeVisible()
  })

  it('shows a charged failed stream and its actual error', async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={client}>
        <TerminalRequests />
      </QueryClientProvider>
    )
    const row = (await screen.findByText('partial-stream')).closest('article')
    if (!row) throw new Error('Missing request row')
    expect(row).toHaveTextContent(
      new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(requestCreatedAt * 1000))
    )
    expect(within(row).getByText('Failed')).toBeVisible()
    expect(
      within(row)
        .getAllByRole('term')
        .map((term) => term.textContent)
    ).toEqual(['Tokens', 'Charge', 'Saved', 'Time taken'])
    expect(
      within(row).getByText('Charge').nextElementSibling
    ).toHaveTextContent('¥1.4')
    expect(
      within(row).queryByText('Before-discount estimate')
    ).not.toBeInTheDocument()
    expect(within(row).getByText('Saved').nextElementSibling).toHaveTextContent(
      '¥1.4'
    )
    await user.click(within(row).getByRole('button'))
    const details = await screen.findByRole('dialog', {
      name: 'Request details',
    })
    expect(
      within(details).getByText(
        'The response was interrupted before it finished.'
      )
    ).toBeVisible()
    await user.click(within(details).getByText('Original error'))
    expect(within(details).getByText('upstream timeout')).toBeVisible()
  })

  it('merges standalone errors with consume logs before displaying the page', async () => {
    includeStandaloneError = true

    render(
      <QueryClientProvider client={client}>
        <TerminalRequests />
      </QueryClientProvider>
    )

    expect(await screen.findByText('standalone-error')).toBeVisible()
    expect(screen.getByText('partial-stream')).toBeVisible()
  })

  it.each([
    ['unrecorded multiplier', {}, 2, '¥1.4', '—', 'Saved', '—'],
    [
      'unrecorded multiplier with a recorded fee',
      { fee_quota: 84000 },
      2,
      '¥1.176',
      '—',
      'Saved',
      '—',
    ],
    ['full price', { group_ratio: 1 }, 2, '¥1.4', '¥1.4', 'Saved', '¥0'],
    [
      'surcharge',
      { group_ratio: 2 },
      2,
      '¥1.4',
      '¥0.7',
      'Above base price',
      '¥0.7',
    ],
    [
      'recorded fee',
      { group_ratio: 0.5, fee_quota: 84000 },
      2,
      '¥1.176',
      '¥2.352',
      'Saved',
      '¥1.176',
    ],
    [
      'subscription',
      { group_ratio: 0.5, billing_source: 'subscription' },
      2,
      'Subscription',
      '—',
      'Saved',
      '—',
    ],
    [
      'unbilled failure',
      { group_ratio: 0.5 },
      5,
      'No charge',
      '—',
      'Saved',
      '—',
    ],
  ] as const)(
    'shows truthful prices for %s',
    async (_name, other, type, spent, _base, savedLabel, saved) => {
      requestOther = other
      requestType = type
      render(
        <QueryClientProvider client={client}>
          <TerminalRequests />
        </QueryClientProvider>
      )
      const row = (await screen.findByText('partial-stream')).closest('article')
      if (!row) throw new Error('Missing request row')
      expect(
        within(row).getByText('Charge').nextElementSibling
      ).toHaveTextContent(spent)
      expect(
        within(row).queryByText('Before-discount estimate')
      ).not.toBeInTheDocument()
      expect(
        within(row).getByText(savedLabel).nextElementSibling
      ).toHaveTextContent(saved)
    }
  )

  it('opens complete details for a successful request and returns focus after closing', async () => {
    const user = userEvent.setup()
    streamFails = false
    requestOther = {
      group_ratio: 0.5,
      model_ratio: 1,
      completion_ratio: 2,
      cache_ratio: 0.1,
      cache_creation_ratio: 1.25,
      cache_tokens: 2,
      admin_info: { use_channel: [555] },
    }
    render(
      <QueryClientProvider client={client}>
        <TerminalRequests />
      </QueryClientProvider>
    )
    const row = (await screen.findByText('partial-stream')).closest('article')
    if (!row) throw new Error('Missing request row')
    const trigger = within(row).getByRole('button')
    await user.click(trigger)
    const details = await screen.findByRole('dialog', {
      name: 'Request details',
    })
    expect(
      within(details).getByText('Input Tokens').nextElementSibling
    ).toHaveTextContent('4')
    expect(
      within(details).getByText('Output Tokens').nextElementSibling
    ).toHaveTextContent('1')
    expect(
      within(details).getByText('Cache Read').nextElementSibling
    ).toHaveTextContent('2')
    expect(
      within(details).getByText('Discount rate').nextElementSibling
    ).toHaveTextContent('50%')
    expect(
      within(details).getByText('Base input price').nextElementSibling
    ).toHaveTextContent('¥14 /M')
    expect(
      within(details).getByText('Base output price').nextElementSibling
    ).toHaveTextContent('¥28 /M')
    expect(
      within(details).getByText('Base cache read price').nextElementSibling
    ).toHaveTextContent('¥1.4 /M')
    expect(
      within(details).getByText('Base cache write price').nextElementSibling
    ).toHaveTextContent('¥17.5 /M')
    const requestCost = within(details).getByRole('region', {
      name: 'Request cost',
    })
    const basePrices = within(details).getByRole('region', {
      name: 'Base unit prices',
    })
    expect(
      within(requestCost).getByText('Charge').nextElementSibling
    ).toHaveTextContent('¥1.4')
    expect(
      within(requestCost).queryByText('Base input price')
    ).not.toBeInTheDocument()
    expect(
      within(basePrices).getByText('Base input price').nextElementSibling
    ).toHaveTextContent('¥14 /M')
    expect(within(basePrices).queryByText('Charge')).not.toBeInTheDocument()
    expect(
      within(basePrices).getByText(
        'Unit prices are per million tokens, before the request discount, using the rates recorded at the time.'
      )
    ).toBeVisible()
    expect(within(details).queryByText('555')).toBeNull()
    await user.click(
      within(details).getByRole('button', { name: 'Copy request ID' })
    )
    expect(await navigator.clipboard.readText()).toBe('request-001')
    await user.click(within(details).getByRole('button', { name: 'Close' }))
    expect(trigger).toHaveFocus()
  })

  it('omits original prices and savings for per-request billing in rows and details', async () => {
    const user = userEvent.setup()
    requestOther = { model_price: 0.05, group_ratio: 0.5 }
    streamFails = false
    render(
      <QueryClientProvider client={client}>
        <TerminalRequests />
      </QueryClientProvider>
    )
    const row = (await screen.findByText('partial-stream')).closest('article')
    if (!row) throw new Error('Missing request row')
    expect(within(row).queryByText('Saved')).not.toBeInTheDocument()
    expect(
      within(row).getByText('Charge').nextElementSibling
    ).toHaveTextContent('¥1.4')
    await user.click(within(row).getByRole('button'))
    const details = await screen.findByRole('dialog', {
      name: 'Request details',
    })
    expect(
      within(details).getByText('Charge').nextElementSibling
    ).toHaveTextContent('¥1.4')
    for (const label of [
      'Before-discount estimate',
      'Discount rate',
      'Saved',
      'Base unit prices',
      'Base price per request',
    ]) {
      expect(within(details).queryByText(label)).not.toBeInTheDocument()
    }
    expect(
      within(details).queryByText(
        'The recorded price is incomplete, so savings cannot be calculated.'
      )
    ).not.toBeInTheDocument()
  })

  it('omits the above-base comparison from easy request details without changing the charged amount', async () => {
    const user = userEvent.setup()
    requestOther = { group_ratio: 1.2, model_ratio: 1, completion_ratio: 2 }
    streamFails = false
    render(
      <QueryClientProvider client={client}>
        <TerminalRequests />
      </QueryClientProvider>
    )
    await screen.findByText('partial-stream')
    await user.click(screen.getByRole('button', { name: /partial-stream/ }))
    const details = await screen.findByRole('dialog', {
      name: 'Request details',
    })
    expect(
      within(details).queryByText('Above base price')
    ).not.toBeInTheDocument()
    expect(within(details).queryByText('Saved')).not.toBeInTheDocument()
    expect(
      within(details).getByText('Charge').nextElementSibling
    ).toHaveTextContent('¥1.4')
    expect(
      within(details).getByText('Discount rate').nextElementSibling
    ).toHaveTextContent('0%')
  })

  it('shows free cache reads and separate timed cache-write prices with per-million units', async () => {
    const user = userEvent.setup()
    requestOther = {
      group_ratio: 0.5,
      model_ratio: 0.5,
      completion_ratio: 3,
      cache_ratio: 0,
      cache_creation_ratio: 1.25,
      cache_creation_ratio_5m: 1.25,
      cache_creation_ratio_1h: 2,
    }
    streamFails = false
    render(
      <QueryClientProvider client={client}>
        <TerminalRequests />
      </QueryClientProvider>
    )
    await screen.findByText('partial-stream')
    await user.click(screen.getByRole('button', { name: /partial-stream/ }))
    const details = await screen.findByRole('dialog', {
      name: 'Request details',
    })
    expect(
      within(details).getByText('Base cache read price').nextElementSibling
    ).toHaveTextContent('¥0 /M')
    expect(
      within(details).getByText('Base cache write price (5m)')
        .nextElementSibling
    ).toHaveTextContent('¥8.75 /M')
    expect(
      within(details).getByText('Base cache write price (1h)')
        .nextElementSibling
    ).toHaveTextContent('¥14 /M')
    expect(
      within(details).queryByText('Base cache write price')
    ).not.toBeInTheDocument()
  })

  it('removes the unsupported reserved-balance card from the overview', async () => {
    await renderApp(<TerminalHome />, client)
    await screen.findByText('Connect your client')
    expect(screen.queryByText('Reserved')).toBeNull()
    expect(screen.queryByText('Not held separately on this gateway')).toBeNull()
  })

  it('opens the historical beginner guide from the easy terminal overview', async () => {
    await renderApp(<TerminalHome />, client)

    expect(
      await screen.findByRole('link', { name: 'Read the docs' })
    ).toHaveAttribute('href', '/beginner-guide')
  })

  it('shows distinct balance, daily wallet spending and savings while reusing the daily summary on requests', async () => {
    const home = await renderApp(<TerminalHome />, client)
    expect(await screen.findByText('Wallet spending today')).toBeVisible()
    await waitFor(() =>
      expect(
        screen.getByText('Wallet spending today').closest('article')
      ).toHaveTextContent('¥7')
    )
    expect(
      screen.getByText('Savings today').closest('article')
    ).toHaveTextContent('¥3.5')
    expect(screen.getByText('Available balance')).toBeVisible()
    expect(screen.queryByText('Available')).toBeNull()
    expect(requestedWindow).toBe(86400)
    expect(requestedStart).toBe(
      Math.floor(new Date().setHours(0, 0, 0, 0) / 1000)
    )
    home.unmount()
    render(
      <QueryClientProvider client={client}>
        <TerminalRequests />
      </QueryClientProvider>
    )
    await screen.findByText('partial-stream')
    expect(summaryRequests).toBe(1)
  })

  it('explains a page-only filter with no matching requests without changing daily totals', async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={client}>
        <TerminalRequests />
      </QueryClientProvider>
    )
    await screen.findByText('partial-stream')
    await user.click(screen.getByRole('button', { name: 'Worked 0' }))
    expect(screen.getByRole('button', { name: 'Worked 0' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(
      screen.getByText(
        'No matching requests on this page. Try another filter or page.'
      )
    ).toBeVisible()
    expect(
      screen.getByText('Requests today').closest('article')
    ).toHaveTextContent('103')
  })

  it('renders the complete daily summary instead of rebuilding it from one log page', async () => {
    render(
      <QueryClientProvider client={client}>
        <TerminalReports />
      </QueryClientProvider>
    )
    expect(await screen.findByText('2026-09-08')).toBeVisible()
    const row = screen.getByRole('row', { name: /2026-09-08/ })
    expect(within(row).getByText('101')).toBeVisible()
    expect(within(row).getByText('¥5.6')).toBeVisible()
    expect(requestedWindow).toBe(10 * 86400)
    expect(screen.queryByText('Cumulative usage')).not.toBeInTheDocument()
    for (const card of screen.getAllByRole('article')) {
      expect(card).toHaveTextContent(/last 10 days/i)
    }
    expect(
      screen.getByText(
        'Review the last 10 days of usage and export daily totals.'
      )
    ).toBeVisible()
  })

  it('keeps ten fixed-offset days when the interval crosses a daylight-saving change', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 2, 12))
    render(
      <QueryClientProvider client={client}>
        <TerminalReports />
      </QueryClientProvider>
    )
    await screen.findByText('2026-09-08')
    expect(requestedWindow).toBe(10 * 86400)
    expect(requestedStart).toBe(
      Date.UTC(2026, 9, 24) / 1000 + new Date().getTimezoneOffset() * 60
    )
  })

  it('shows summary failures instead of a successful empty report', async () => {
    summaryFails = true
    render(
      <QueryClientProvider client={client}>
        <TerminalReports />
      </QueryClientProvider>
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Report unavailable'
    )
    expect(screen.getByRole('button', { name: 'Export report' })).toBeDisabled()
  })
})
