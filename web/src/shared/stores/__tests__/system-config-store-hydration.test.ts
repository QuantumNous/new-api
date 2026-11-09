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
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_SYSTEM_NAME, DEFAULT_LOGO } from '@/shared/lib/constants'

const STORAGE_KEY = 'system-config-storage'

async function loadStore() {
  vi.resetModules()
  const storeModule = await import('../system-config-store')
  await storeModule.useSystemConfigStore.persist.rehydrate()
  return storeModule
}

beforeEach(() => {
  localStorage.clear()
})

describe('system config rehydration', () => {
  it('rebuilds a render-safe config from a corrupt persisted shape', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          config: null,
          loadedLogoUrl: 42,
        },
        version: 0,
      })
    )

    const { useSystemConfigStore, DEFAULT_SYSTEM_CONFIG } = await loadStore()
    const { config } = useSystemConfigStore.getState()

    expect(config.systemName).toBe(DEFAULT_SYSTEM_NAME)
    expect(config.logo).toBe(DEFAULT_LOGO)
    expect(config.currency).toEqual(DEFAULT_SYSTEM_CONFIG.currency)
    expect(Number.isFinite(config.currency.quotaPerUnit)).toBe(true)
  })

  it('replaces wrong-typed fields while keeping valid branding', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          config: {
            systemName: { broken: true },
            logo: 5,
            footerHtml: ['not', 'a', 'string'],
            currency: {
              quotaDisplayType: 'NOT_A_CURRENCY',
              quotaPerUnit: 'not-a-number',
              displayInCurrency: 'yes',
            },
          },
        },
        version: 0,
      })
    )

    const { useSystemConfigStore, DEFAULT_SYSTEM_CONFIG } = await loadStore()
    const { config } = useSystemConfigStore.getState()

    expect(config.systemName).toBe(DEFAULT_SYSTEM_NAME)
    expect(config.logo).toBe(DEFAULT_LOGO)
    expect(config.footerHtml).toBeUndefined()
    expect(config.currency.quotaDisplayType).toBe('USD')
    expect(config.currency.quotaPerUnit).toBe(
      DEFAULT_SYSTEM_CONFIG.currency.quotaPerUnit
    )
    expect(config.currency.displayInCurrency).toBe(true)
  })

  it('preserves a valid persisted configuration', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          config: {
            systemName: 'Acme Gateway',
            logo: '/logo.png',
            demoSiteEnabled: true,
            currency: {
              displayInCurrency: false,
              quotaDisplayType: 'CNY',
              quotaPerUnit: 1000,
            },
          },
          loadedLogoUrl: '/logo.png',
        },
        version: 0,
      })
    )

    const { useSystemConfigStore } = await loadStore()
    const { config } = useSystemConfigStore.getState()

    expect(config.systemName).toBe('Acme Gateway')
    expect(config.logo).toBe('/logo.png')
    expect(config.demoSiteEnabled).toBe(true)
    expect(config.currency.displayInCurrency).toBe(false)
    expect(config.currency.quotaDisplayType).toBe('CNY')
    expect(config.currency.quotaPerUnit).toBe(1000)
  })
})
