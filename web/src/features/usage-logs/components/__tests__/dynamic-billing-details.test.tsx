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
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { QueryClient } from '@tanstack/react-query'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { Sheet } from '@/components/ui/sheet'
import { useSystemConfigStore } from '@/stores/system-config-store'
import { renderApp } from '@/test-utils/render-app'

import type { UsageLog } from '../../data/schema'
import { TerminalRequestDetails } from '../terminal-request-details'

const originalConfig = useSystemConfigStore.getState().config
let stylesheet: HTMLStyleElement
const expression = 'tier("base", p * 2 + c * 10 + cr * 0.2 + cc * 4 + cc1h * 0)'

function makeLog(includeSettlementTrace = true): UsageLog {
  return {
    id: 1,
    user_id: 1,
    created_at: 1_789_156_800,
    type: 2,
    content: '',
    username: 'demo',
    token_name: 'work-key',
    model_name: 'dynamic-model',
    quota: 119,
    prompt_tokens: 232,
    completion_tokens: 16,
    use_time: 1,
    is_stream: false,
    channel: 1,
    channel_name: 'channel',
    token_id: 1,
    group: 'default',
    ip: '',
    request_id: 'request-dynamic',
    upstream_request_id: '',
    other: JSON.stringify({
      billing_mode: 'tiered_expr',
      expr_b64: Buffer.from(expression, 'utf8').toString('base64'),
      matched_tier: 'base',
      group_ratio: 1,
      cache_tokens: 200,
      cache_creation_tokens_5m: 7,
      ...(includeSettlementTrace
        ? {
            billing_usage: {
              p: 5,
              c: 16,
              len: 232,
              cr: 200,
              cc: 7,
              cc1h: 0,
              img: 0,
              img_o: 0,
              ai: 0,
              ao: 0,
            },
            billing_cost_before_group: 0.000238,
          }
        : {}),
    }),
  }
}

function makeInputPricedCacheLog(): UsageLog {
  const log = makeLog()
  const other = JSON.parse(log.other) as Record<string, unknown>
  other.expr_b64 = Buffer.from('tier("base", p * 2 + c * 10)', 'utf8').toString(
    'base64'
  )
  other.billing_usage = {
    p: 232,
    c: 16,
    len: 232,
    cr: 200,
    cc: 0,
    cc1h: 0,
    img: 0,
    img_o: 0,
    ai: 0,
    ao: 0,
  }
  other.billing_cost_before_group = 0.000624
  return { ...log, quota: 312, other: JSON.stringify(other) }
}

async function renderDetails(log = makeLog()) {
  const client = new QueryClient()
  await renderApp(
    <Sheet open>
      <TerminalRequestDetails log={log} />
    </Sheet>,
    client
  )
  return client
}

beforeEach(() => {
  stylesheet = document.createElement('style')
  stylesheet.textContent = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../../styles/ci-landing.css'
    ),
    'utf8'
  )
  document.head.append(stylesheet)
  useSystemConfigStore.setState({
    config: {
      ...originalConfig,
      currency: {
        ...originalConfig.currency,
        quotaPerUnit: 500000,
        quotaDisplayType: 'CNY',
        usdExchangeRate: 1,
      },
    },
  })
})

afterEach(() => {
  cleanup()
  stylesheet.remove()
  useSystemConfigStore.setState({ config: originalConfig })
})

describe('dynamic request detail billing', () => {
  it('keeps every declared matched-tier unit price visible in a dedicated section', async () => {
    const client = await renderDetails()
    const details = await screen.findByRole('dialog', {
      name: 'Request details',
    })
    const prices = within(details).getByRole('region', {
      name: 'Matched unit prices',
    })
    const billingLayout = prices.parentElement
    if (!billingLayout) throw new Error('Missing billing layout')

    expect(getComputedStyle(billingLayout).gridTemplateColumns).toBe(
      'minmax(0, 1fr)'
    )
    expect(within(prices).getByText('Input').closest('div')).toHaveTextContent(
      '¥2 /M'
    )
    expect(within(prices).getByText('Output').closest('div')).toHaveTextContent(
      '¥10 /M'
    )
    expect(
      within(prices).getByText('Cache Read').closest('div')
    ).toHaveTextContent('¥0.2 /M')
    expect(
      within(prices).getByText('Cache Write').closest('div')
    ).toHaveTextContent('¥4 /M')
    expect(
      within(prices).getByText('Cache Write (1h)').closest('div')
    ).toHaveTextContent('¥0 /M')
    expect(
      within(details).queryByText(
        'This request used dynamic pricing. The recorded charge includes its usage-based calculation.'
      )
    ).not.toBeInTheDocument()
    client.clear()
  })

  it('shows the verified input, output and cache bill on hover and keyboard focus', async () => {
    const user = userEvent.setup()
    const client = await renderDetails()
    const trigger = screen.getByRole('button', { name: 'Billing Details' })

    await user.hover(trigger)
    let bill = await screen.findByRole('tooltip', { name: 'Billing Details' })
    expect(getComputedStyle(bill.parentElement as HTMLElement).zIndex).toBe(
      '80'
    )
    expect(within(bill).getByText('Input').closest('div')).toHaveTextContent(
      '5 × ¥2/M¥0.00001'
    )
    expect(within(bill).getByText('Output').closest('div')).toHaveTextContent(
      '16 × ¥10/M¥0.00016'
    )
    expect(
      within(bill).getByText('Cache Read').closest('div')
    ).toHaveTextContent('200 × ¥0.2/M¥0.00004')
    expect(
      within(bill).getByText('Cache Write').closest('div')
    ).toHaveTextContent('7 × ¥4/M¥0.000028')
    expect(
      within(bill).getByText('Before-discount estimate').closest('div')
    ).toHaveTextContent('¥0.000238')
    expect(within(bill).getByText('Charge').closest('div')).toHaveTextContent(
      '¥0.000238'
    )

    await user.unhover(trigger)
    await waitFor(() =>
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    )
    trigger.focus()
    bill = await screen.findByRole('tooltip', { name: 'Billing Details' })
    expect(bill).toBeVisible()
    client.clear()
  })

  it('opens the verified bill on press and closes it with Escape', async () => {
    const user = userEvent.setup()
    const client = await renderDetails()
    const trigger = screen.getByRole('button', { name: 'Billing Details' })

    await user.click(trigger)
    expect(
      await screen.findByRole('tooltip', { name: 'Billing Details' })
    ).toBeVisible()
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    )
    client.clear()
  })

  it('keeps legacy unit prices but omits an unverifiable bill trigger', async () => {
    const client = await renderDetails(makeLog(false))
    const details = await screen.findByRole('dialog', {
      name: 'Request details',
    })

    expect(
      within(details).getByRole('region', { name: 'Matched unit prices' })
    ).toBeVisible()
    expect(
      within(details).queryByRole('button', { name: 'Billing Details' })
    ).not.toBeInTheDocument()
    client.clear()
  })

  it('explains cache usage that the expression intentionally bills at the input price', async () => {
    const client = await renderDetails(makeInputPricedCacheLog())
    const details = await screen.findByRole('dialog', {
      name: 'Request details',
    })
    const prices = within(details).getByRole('region', {
      name: 'Matched unit prices',
    })

    expect(
      within(prices).getByText('Cache usage is included in the input price.')
    ).toBeVisible()
    expect(within(prices).queryByText('Cache Read')).not.toBeInTheDocument()
    client.clear()
  })
})
