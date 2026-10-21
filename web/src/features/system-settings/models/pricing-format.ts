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
import {
  formatBillingCurrencyFromUSD,
  getCurrencyDisplay,
  getCurrencyLabel,
} from '@/lib/currency'

const DISPLAY_DECIMALS = 12
const SNAP_DECIMALS = 8
const SNAP_EPSILON = 1e-12

function toNumberOrNull(value: unknown): number | null {
  if (
    value === '' ||
    value === null ||
    value === undefined ||
    value === false
  ) {
    return null
  }

  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function roundToDecimals(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function snapFloatDrift(value: number): number {
  const tolerance = Math.max(SNAP_EPSILON, Math.abs(value) * Number.EPSILON * 8)

  for (let decimals = 0; decimals <= SNAP_DECIMALS; decimals += 1) {
    const rounded = roundToDecimals(value, decimals)
    if (Math.abs(value - rounded) <= tolerance) {
      return rounded
    }
  }

  return value
}

export function formatPricingNumber(value: unknown): string {
  const num = toNumberOrNull(value)
  if (num === null) return ''

  const normalized = snapFloatDrift(num)
  return Number.parseFloat(normalized.toFixed(DISPLAY_DECIMALS)).toString()
}

function getBillingExchangeRate(): number {
  const { config, meta } = getCurrencyDisplay()

  if (meta.kind === 'tokens') {
    return 1
  }

  if (config.quotaDisplayType === 'CNY') {
    return config.usdExchangeRate > 0 ? config.usdExchangeRate : 1
  }

  if (config.quotaDisplayType === 'CUSTOM') {
    return config.customCurrencyExchangeRate > 0
      ? config.customCurrencyExchangeRate
      : 1
  }

  return 1
}

export function usdToDisplayPricingValue(valueUsd: unknown): string {
  const num = toNumberOrNull(valueUsd)
  if (num === null) return ''

  return (snapFloatDrift(num) * getBillingExchangeRate()).toFixed(2)
}

export function displayPricingValueToUsd(value: unknown): number | null {
  const num = toNumberOrNull(value)
  if (num === null) return null

  const exchangeRate = getBillingExchangeRate()
  return snapFloatDrift(exchangeRate > 0 ? num / exchangeRate : num)
}

export function formatModelPricingAmountFromUSD(valueUsd: unknown): string {
  const num = toNumberOrNull(valueUsd)
  if (num === null) return ''

  return formatBillingCurrencyFromUSD(num, {
    digitsLarge: 2,
    digitsSmall: 2,
    abbreviate: false,
    minimumNonZero: 0,
  })
}

export function getModelPricingCurrencyPrefix(): string {
  const { config, meta } = getCurrencyDisplay()

  if (meta.kind === 'currency') {
    return config.quotaDisplayType === 'CNY' ? '¥' : '$'
  }

  if (meta.kind === 'custom') {
    return meta.symbol
  }

  return '$'
}

export function getModelPricingUnitLabel(): string {
  const { meta } = getCurrencyDisplay()
  if (meta.kind === 'tokens') {
    return 'USD/1M'
  }
  return `${getCurrencyLabel()}/1M`
}
