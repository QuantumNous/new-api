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
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { DEFAULT_SYSTEM_NAME, DEFAULT_LOGO } from '@/shared/lib/constants'

export type CurrencyDisplayType = 'USD' | 'CNY' | 'TOKENS' | 'CUSTOM'

export interface CurrencyConfig {
  /** Whether to render quota values as currency instead of raw units */
  displayInCurrency: boolean
  /** Currency presentation strategy configured by the admin */
  quotaDisplayType: CurrencyDisplayType
  /** Number of quota units that equal one USD */
  quotaPerUnit: number
  /** Exchange rate from USD to the configured local currency */
  usdExchangeRate: number
  /** Custom currency symbol configured by the admin (used when type === CUSTOM) */
  customCurrencySymbol: string
  /** Exchange rate from USD to the custom currency (used when type === CUSTOM) */
  customCurrencyExchangeRate: number
}

export interface SystemConfig {
  systemName: string
  logo: string
  footerHtml?: string
  demoSiteEnabled?: boolean
  displayTokenStatEnabled?: boolean
  /** Admin toggle: hide the navigation toggle button on the public home page. */
  hideHomePageSidebarToggle?: boolean
  currency: CurrencyConfig
}

export const DEFAULT_CURRENCY_CONFIG: CurrencyConfig = {
  displayInCurrency: true,
  quotaDisplayType: 'USD',
  quotaPerUnit: 500000,
  usdExchangeRate: 1,
  customCurrencySymbol: '¤',
  customCurrencyExchangeRate: 1,
}

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  systemName: DEFAULT_SYSTEM_NAME,
  logo: DEFAULT_LOGO,
  currency: { ...DEFAULT_CURRENCY_CONFIG },
}

const CURRENCY_DISPLAY_TYPES = new Set<CurrencyDisplayType>([
  'USD',
  'CNY',
  'TOKENS',
  'CUSTOM',
])

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function nonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function normalizeCurrencyConfig(value: unknown): CurrencyConfig {
  const record = isRecord(value) ? value : {}
  const displayType = record.quotaDisplayType

  return {
    displayInCurrency:
      typeof record.displayInCurrency === 'boolean'
        ? record.displayInCurrency
        : DEFAULT_CURRENCY_CONFIG.displayInCurrency,
    quotaDisplayType:
      typeof displayType === 'string' &&
      CURRENCY_DISPLAY_TYPES.has(displayType as CurrencyDisplayType)
        ? (displayType as CurrencyDisplayType)
        : DEFAULT_CURRENCY_CONFIG.quotaDisplayType,
    quotaPerUnit: finiteNumber(
      record.quotaPerUnit,
      DEFAULT_CURRENCY_CONFIG.quotaPerUnit
    ),
    usdExchangeRate: finiteNumber(
      record.usdExchangeRate,
      DEFAULT_CURRENCY_CONFIG.usdExchangeRate
    ),
    customCurrencySymbol: nonEmptyString(
      record.customCurrencySymbol,
      DEFAULT_CURRENCY_CONFIG.customCurrencySymbol
    ),
    customCurrencyExchangeRate: finiteNumber(
      record.customCurrencyExchangeRate,
      DEFAULT_CURRENCY_CONFIG.customCurrencyExchangeRate
    ),
  }
}

/**
 * Coerce untrusted config (persisted storage, an old schema, a partially
 * written object) into a complete, render-safe `SystemConfig`.
 *
 * `systemName` and `logo` are rendered directly, so a non-string there would
 * crash React with "Objects are not valid as a React child".
 */
export function normalizeSystemConfig(value: unknown): SystemConfig {
  const record = isRecord(value) ? value : {}

  return {
    systemName: nonEmptyString(record.systemName, DEFAULT_SYSTEM_NAME),
    logo: nonEmptyString(record.logo, DEFAULT_LOGO),
    footerHtml: optionalString(record.footerHtml),
    demoSiteEnabled: optionalBoolean(record.demoSiteEnabled),
    displayTokenStatEnabled: optionalBoolean(record.displayTokenStatEnabled),
    hideHomePageSidebarToggle: optionalBoolean(
      record.hideHomePageSidebarToggle
    ),
    currency: normalizeCurrencyConfig(record.currency),
  }
}

interface SystemConfigState {
  config: SystemConfig
  loading: boolean
  loadedLogoUrl: string
  setConfig: (config: Partial<SystemConfig>) => void
  setLoadedLogoUrl: (url: string) => void
  setLoading: (loading: boolean) => void
}

/**
 * System configuration store with automatic persistence
 * Manages system name, logo, footer HTML and loading states
 */
export const useSystemConfigStore = create<SystemConfigState>()(
  persist(
    (set) => ({
      config: {
        ...DEFAULT_SYSTEM_CONFIG,
        currency: { ...DEFAULT_SYSTEM_CONFIG.currency },
      },
      loading: true,
      loadedLogoUrl: DEFAULT_LOGO,
      setConfig: (newConfig) =>
        set((state) => ({
          config: normalizeSystemConfig({
            ...state.config,
            ...newConfig,
            currency: {
              ...state.config.currency,
              ...newConfig.currency,
            },
          }),
        })),
      setLoadedLogoUrl: (url) => set({ loadedLogoUrl: url }),
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: 'system-config-storage',
      partialize: (state) => ({
        config: state.config,
        loadedLogoUrl: state.loadedLogoUrl,
      }),
      // A stale entry can contain valid JSON of the wrong shape (for example
      // `config: null`). Left as-is, that crashes the auth layout while it
      // reads `config.logo`, so every persisted value is normalized here.
      merge: (persistedState, currentState) => {
        if (!isRecord(persistedState)) return currentState

        return {
          ...currentState,
          config: normalizeSystemConfig(persistedState.config),
          loadedLogoUrl: nonEmptyString(
            persistedState.loadedLogoUrl,
            currentState.loadedLogoUrl
          ),
        }
      },
    }
  )
)

// Selector helpers for convenience
export const getSystemName = () =>
  useSystemConfigStore.getState().config.systemName

export const getLogo = () => useSystemConfigStore.getState().config.logo

export const getFooterHtml = () =>
  useSystemConfigStore.getState().config.footerHtml
