import assert from 'node:assert/strict'
import { describe, test } from 'vitest'

const storage = new Map<string, string>()
const localStorageShim = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
  get length() {
    return storage.size
  },
} as Storage

globalThis.localStorage = localStorageShim
globalThis.window = { localStorage: localStorageShim } as unknown as Window &
  typeof globalThis

describe('wallet amount formatting', () => {
  test('formats recharge amount in the selected display currency', async () => {
    const { useSystemConfigStore } =
      await import('@/stores/system-config-store')
    const { formatWalletDisplayAmount } = await import('./format')

    useSystemConfigStore.getState().setConfig({
      currency: {
        displayInCurrency: true,
        quotaDisplayType: 'USD',
        quotaPerUnit: 500000,
        usdExchangeRate: 7,
        customCurrencySymbol: '¤',
        customCurrencyExchangeRate: 1,
      },
    })

    assert.equal(formatWalletDisplayAmount(10), '$10')

    useSystemConfigStore.getState().setConfig({
      currency: {
        displayInCurrency: true,
        quotaDisplayType: 'CNY',
        quotaPerUnit: 500000,
        usdExchangeRate: 7,
        customCurrencySymbol: '¤',
        customCurrencyExchangeRate: 1,
      },
    })

    assert.equal(formatWalletDisplayAmount(73), '¥73')
  })

  test('formats actual payment amount in local payment currency', async () => {
    const { useSystemConfigStore } =
      await import('@/stores/system-config-store')
    const { formatWalletPaymentAmount } = await import('./format')

    useSystemConfigStore.getState().setConfig({
      currency: {
        displayInCurrency: true,
        quotaDisplayType: 'USD',
        quotaPerUnit: 500000,
        usdExchangeRate: 7,
        customCurrencySymbol: '¤',
        customCurrencyExchangeRate: 1,
      },
    })

    assert.equal(formatWalletPaymentAmount(73), '¥73')
  })

  test('builds preset display with payment amount only for CNY display', async () => {
    const { useSystemConfigStore } =
      await import('@/stores/system-config-store')
    const { getPresetAmountDisplay } = await import('./format')

    useSystemConfigStore.getState().setConfig({
      currency: {
        displayInCurrency: true,
        quotaDisplayType: 'CNY',
        quotaPerUnit: 500000,
        usdExchangeRate: 7,
        customCurrencySymbol: '¤',
        customCurrencyExchangeRate: 1,
      },
    })

    assert.deepEqual(getPresetAmountDisplay(10, 73), {
      primary: '¥73',
      secondary: '',
    })
  })

  test('builds preset display with recharge and payment amount for USD display', async () => {
    const { useSystemConfigStore } =
      await import('@/stores/system-config-store')
    const { getPresetAmountDisplay } = await import('./format')

    useSystemConfigStore.getState().setConfig({
      currency: {
        displayInCurrency: true,
        quotaDisplayType: 'USD',
        quotaPerUnit: 500000,
        usdExchangeRate: 7,
        customCurrencySymbol: '¤',
        customCurrencyExchangeRate: 1,
      },
    })

    assert.deepEqual(getPresetAmountDisplay(10, 73), {
      primary: '$10',
      secondary: 'Pay ¥73',
    })
  })

  test('uses payment amount as selected topup amount for CNY preset display', async () => {
    const { useSystemConfigStore } =
      await import('@/stores/system-config-store')
    const { getPresetTopupAmount } = await import('./format')

    useSystemConfigStore.getState().setConfig({
      currency: {
        displayInCurrency: true,
        quotaDisplayType: 'CNY',
        quotaPerUnit: 500000,
        usdExchangeRate: 7,
        customCurrencySymbol: '¤',
        customCurrencyExchangeRate: 1,
      },
    })

    assert.equal(getPresetTopupAmount(10, 73), 73)
  })

  test('uses recharge amount as selected topup amount for USD preset display', async () => {
    const { useSystemConfigStore } =
      await import('@/stores/system-config-store')
    const { getPresetTopupAmount } = await import('./format')

    useSystemConfigStore.getState().setConfig({
      currency: {
        displayInCurrency: true,
        quotaDisplayType: 'USD',
        quotaPerUnit: 500000,
        usdExchangeRate: 7,
        customCurrencySymbol: '¤',
        customCurrencyExchangeRate: 1,
      },
    })

    assert.equal(getPresetTopupAmount(10, 73), 10)
  })

  test('formats confirmation topup amount without applying exchange rate again', async () => {
    const { useSystemConfigStore } =
      await import('@/stores/system-config-store')
    const { formatWalletConfirmationTopupAmount } = await import('./format')

    useSystemConfigStore.getState().setConfig({
      currency: {
        displayInCurrency: true,
        quotaDisplayType: 'CNY',
        quotaPerUnit: 500000,
        usdExchangeRate: 7,
        customCurrencySymbol: '¤',
        customCurrencyExchangeRate: 1,
      },
    })

    assert.equal(formatWalletConfirmationTopupAmount(73), '¥73')
  })

  test('keeps custom amount input as the backend topup amount', async () => {
    const { displayAmountToTopupAmount } = await import('./format')

    assert.equal(displayAmountToTopupAmount(10, 7), 10)
  })
})
