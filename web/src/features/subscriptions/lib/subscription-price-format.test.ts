import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

const storage = new Map<string, string>()
const localStorageShim = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value)
  },
  removeItem: (key: string) => {
    storage.delete(key)
  },
  clear: () => {
    storage.clear()
  },
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
  get length() {
    return storage.size
  },
} as Storage

globalThis.localStorage = localStorageShim
globalThis.window = {
  localStorage: localStorageShim,
} as unknown as Window & typeof globalThis

describe('formatSubscriptionPlanPrice', () => {
  test('formats plan price with the configured CNY currency symbol', async () => {
    const { useSystemConfigStore } =
      await import('@/stores/system-config-store')
    const { formatSubscriptionPlanPrice } =
      await import('./subscription-price-format')

    useSystemConfigStore.getState().setConfig({
      currency: {
        displayInCurrency: true,
        quotaDisplayType: 'CNY',
        quotaPerUnit: 500000,
        usdExchangeRate: 7.3,
        customCurrencySymbol: '¤',
        customCurrencyExchangeRate: 1,
      },
    })

    const formatted = formatSubscriptionPlanPrice(19.9)

    assert.equal(formatted, '¥19.9')
  })
})
