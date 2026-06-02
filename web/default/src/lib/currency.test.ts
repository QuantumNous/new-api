import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'
import { formatQuotaWithCurrency } from './currency'

describe('currency formatting helpers', () => {
  test('formats quota with a caller-supplied CNY display override', () => {
    useSystemConfigStore.setState((state) => ({
      config: {
        ...state.config,
        currency: {
          ...DEFAULT_CURRENCY_CONFIG,
          quotaDisplayType: 'TOKENS',
          quotaPerUnit: 999999,
          usdExchangeRate: 99,
        },
      },
    }))

    assert.equal(
      formatQuotaWithCurrency(2500, {
        abbreviate: false,
        digitsLarge: 2,
        digitsSmall: 2,
        currencyOverride: {
          quotaDisplayType: 'CNY',
          quotaPerUnit: 1000,
          usdExchangeRate: 7,
        },
      }),
      '¥17.5'
    )
  })
})
