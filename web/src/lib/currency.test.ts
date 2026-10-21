import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

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

/**
 * Round-trip parity between {@link convertBillingDisplayToUSD} and
 * {@link convertUSDToBillingDisplay} is the core invariant that makes model
 * pricing currency-consistent with commission redemption and topup:
 *
 * - Backend `service/commission/redeem.go` divides commissionCents by
 *   `USDExchangeRate` to get USD, then multiplies by `QuotaPerUnit`.
 * - Backend `controller/misc.go` exposes the same `USDExchangeRate` to the
 *   frontend as `usd_exchange_rate`.
 * - This library uses that rate to move admin-entered pricing to base USD.
 *
 * If display→USD→display is not lossless, an admin who types "46" in CNY,
 * saves, and reopens will see a different number — that would leak into the
 * ratio table AND diverge from what commission redemption expects.
 */
describe('billing currency round-trip conversion', () => {
  test('CNY input converts to base USD using the configured rate', async () => {
    const { useSystemConfigStore } =
      await import('@/stores/system-config-store')
    const { convertBillingDisplayToUSD } = await import('./currency')

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

    // 46 CNY / 7.3 ≈ 6.301369 — the value that should land in ModelRatio math.
    const usd = convertBillingDisplayToUSD(46)
    assert.ok(Math.abs(usd - 46 / 7.3) < 1e-9, `got ${usd}`)
  })

  test('USD display is a no-op', async () => {
    const { useSystemConfigStore } =
      await import('@/stores/system-config-store')
    const { convertBillingDisplayToUSD, convertUSDToBillingDisplay } =
      await import('./currency')

    useSystemConfigStore.getState().setConfig({
      currency: {
        displayInCurrency: true,
        quotaDisplayType: 'USD',
        quotaPerUnit: 500000,
        usdExchangeRate: 7.3,
        customCurrencySymbol: '¤',
        customCurrencyExchangeRate: 1,
      },
    })

    assert.equal(convertBillingDisplayToUSD(10), 10)
    assert.equal(convertUSDToBillingDisplay(10), 10)
  })

  test('display→USD→display is lossless within float precision', async () => {
    const { useSystemConfigStore } =
      await import('@/stores/system-config-store')
    const { convertBillingDisplayToUSD, convertUSDToBillingDisplay } =
      await import('./currency')

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

    for (const original of [0.01, 0.5, 1, 46, 100, 1234.5678]) {
      const usd = convertBillingDisplayToUSD(original)
      const back = convertUSDToBillingDisplay(usd)
      assert.ok(
        Math.abs(back - original) < 1e-9,
        `round-trip mismatch: ${original} → ${usd} → ${back}`
      )
    }
  })

  test('TOKENS display treats input as USD (no exchange)', async () => {
    const { useSystemConfigStore } =
      await import('@/stores/system-config-store')
    const { convertBillingDisplayToUSD } = await import('./currency')

    useSystemConfigStore.getState().setConfig({
      currency: {
        displayInCurrency: true,
        quotaDisplayType: 'TOKENS',
        quotaPerUnit: 500000,
        usdExchangeRate: 7.3,
        customCurrencySymbol: '¤',
        customCurrencyExchangeRate: 1,
      },
    })

    // Billing displays always fall back to USD when the primary display is
    // TOKENS (see getBillingDisplayMeta); reverse conversion follows suit.
    assert.equal(convertBillingDisplayToUSD(10), 10)
  })

  test('CUSTOM currency uses customCurrencyExchangeRate', async () => {
    const { useSystemConfigStore } =
      await import('@/stores/system-config-store')
    const { convertBillingDisplayToUSD } = await import('./currency')

    useSystemConfigStore.getState().setConfig({
      currency: {
        displayInCurrency: true,
        quotaDisplayType: 'CUSTOM',
        quotaPerUnit: 500000,
        usdExchangeRate: 7.3,
        customCurrencySymbol: '€',
        customCurrencyExchangeRate: 0.9,
      },
    })

    // 9 € / 0.9 = 10 USD
    const usd = convertBillingDisplayToUSD(9)
    assert.ok(Math.abs(usd - 10) < 1e-9, `got ${usd}`)
  })
})
