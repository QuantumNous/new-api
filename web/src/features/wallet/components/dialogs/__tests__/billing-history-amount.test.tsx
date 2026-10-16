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
import { cleanup, render, screen } from '@testing-library/react'
import type { AxiosAdapter } from 'axios'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import type { TopupRecord } from '../../../types'
import { BillingHistoryDialog } from '../billing-history-dialog'

const originalAdapter = api.defaults.adapter
const originalConfig = useSystemConfigStore.getState().config
const balanceRecord: TopupRecord = {
  id: 1,
  user_id: 8,
  amount: 5_000_000_000,
  money: 0,
  trade_no: 'BALUSR8NO-history-regression',
  payment_method: 'balance',
  create_time: 1_800_000_000,
  status: 'success',
}

beforeEach(() => {
  localStorage.clear()
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'billing-admin',
    role: 10,
  })
  useSystemConfigStore.getState().setConfig({
    currency: { ...DEFAULT_CURRENCY_CONFIG },
  })
})

afterEach(() => {
  cleanup()
  api.defaults.adapter = originalAdapter
  useAuthStore.getState().auth.reset()
  useSystemConfigStore.getState().setConfig(originalConfig)
  localStorage.clear()
})

function serveHistory(record: TopupRecord): void {
  const adapter: AxiosAdapter = async (config) => {
    if (
      !config.url?.startsWith('/api/user/topup?') &&
      !config.url?.startsWith('/api/user/topup/self?')
    ) {
      throw new Error('Unexpected billing endpoint')
    }
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { success: true, data: { items: [record], total: 1 } },
    }
  }
  api.defaults.adapter = adapter
}

it('displays the reported manual balance order as USD 10000 instead of USD 5 billion', async () => {
  serveHistory(balanceRecord)

  render(<BillingHistoryDialog open onOpenChange={vi.fn()} />)

  expect(await screen.findByText('$10,000')).toBeVisible()
  expect(screen.queryByText('$5,000,000,000')).not.toBeInTheDocument()
  expect(screen.getByText('0')).toBeVisible()
})

it('keeps fractional dollars for balance orders', async () => {
  serveHistory({
    ...balanceRecord,
    amount: 250_000,
  })

  render(<BillingHistoryDialog open onOpenChange={vi.fn()} />)

  expect(await screen.findByText('$0.5')).toBeVisible()
})

it('converts balance orders in the ordinary user history', async () => {
  useAuthStore.getState().auth.setUser({
    id: 8,
    username: 'billing-user',
    role: 1,
  })
  serveHistory({ ...balanceRecord, amount: 500_000 })

  render(<BillingHistoryDialog open onOpenChange={vi.fn()} />)

  expect(await screen.findByText('$1')).toBeVisible()
})

it('uses the configured quota conversion for balance orders', async () => {
  useSystemConfigStore.getState().setConfig({
    currency: { ...DEFAULT_CURRENCY_CONFIG, quotaPerUnit: 1_000_000 },
  })
  serveHistory({ ...balanceRecord, amount: 250_000 })

  render(<BillingHistoryDialog open onOpenChange={vi.fn()} />)

  expect(await screen.findByText('$0.25')).toBeVisible()
})

it('converts a balance order to the configured display currency once', async () => {
  useSystemConfigStore.getState().setConfig({
    currency: {
      ...DEFAULT_CURRENCY_CONFIG,
      quotaDisplayType: 'CNY',
      usdExchangeRate: 7,
    },
  })
  serveHistory({ ...balanceRecord, amount: 500_000 })

  render(<BillingHistoryDialog open onOpenChange={vi.fn()} />)

  expect(await screen.findByText('¥7')).toBeVisible()
})

it.each(['stripe', 'alipay', 'waffo'])(
  'keeps the USD amount of %s orders unchanged',
  async (method) => {
    serveHistory({
      ...balanceRecord,
      amount: 10,
      money: 12,
      payment_method: method,
    })

    render(<BillingHistoryDialog open onOpenChange={vi.fn()} />)

    expect(await screen.findByText('$10')).toBeVisible()
  }
)
