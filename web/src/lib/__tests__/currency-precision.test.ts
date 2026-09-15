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
import { afterEach, beforeEach, expect, test } from 'vitest'

import { useSystemConfigStore } from '@/stores/system-config-store'

import { formatQuotaWithCurrency } from '../currency'

const originalConfig = useSystemConfigStore.getState().config

beforeEach(() => {
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
})

afterEach(() => useSystemConfigStore.setState({ config: originalConfig }))

test('wallet amounts can keep two decimals without changing existing formatting', () => {
  expect(formatQuotaWithCurrency(500000, { minimumFractionDigits: 2 })).toBe(
    '¥7.00'
  )
  expect(formatQuotaWithCurrency(500000)).toBe('¥7')
})

test('minimum decimals preserve sub-cent precision instead of rounding a small charge up to a cent', () => {
  expect(formatQuotaWithCurrency(100, { minimumFractionDigits: 2 })).toBe(
    '¥0.0014'
  )
})
