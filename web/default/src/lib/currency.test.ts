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
import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'

import { useSystemConfigStore } from '@/stores/system-config-store'

import { formatBillingCurrencyFromUSD } from './currency'

const originalConfig = useSystemConfigStore.getState().config

afterEach(() => {
  useSystemConfigStore.setState({ config: originalConfig })
})

describe('billing currency formatting', () => {
  test('uses the frozen billing rate instead of the display exchange rate for CNY', () => {
    useSystemConfigStore.setState({
      config: {
        ...originalConfig,
        currency: {
          ...originalConfig.currency,
          quotaDisplayType: 'CNY',
          usdExchangeRate: 7,
        },
      },
    })

    assert.equal(
      formatBillingCurrencyFromUSD(1, {
        locale: 'en-US',
        billingUSDToCNYRate: 7.3,
      }),
      '¥7.3'
    )
  })

  test('keeps the configured custom-currency conversion', () => {
    useSystemConfigStore.setState({
      config: {
        ...originalConfig,
        currency: {
          ...originalConfig.currency,
          quotaDisplayType: 'CUSTOM',
          customCurrencySymbol: '¤',
          customCurrencyExchangeRate: 0.9,
        },
      },
    })

    assert.equal(
      formatBillingCurrencyFromUSD(1, {
        locale: 'en-US',
        billingUSDToCNYRate: 7.3,
      }),
      '¤ 0.9'
    )
  })
})
