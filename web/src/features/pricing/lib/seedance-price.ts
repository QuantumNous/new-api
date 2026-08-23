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
import { formatCurrencyFromUSD } from '@/lib/currency'

import type { PricingModel, SeedancePublicPricing } from '../types'
import { getDisplayGroupRatio } from './model-helpers'

const SEEDANCE_OUTPUT_RESOLUTIONS = ['480p', '720p', '1080p', '4k'] as const
const SEEDANCE_SR_OUTPUT_RESOLUTIONS = ['720p', '1080p'] as const

function applyRechargeRate(
  price: number,
  showWithRecharge: boolean,
  priceRate: number,
  usdExchangeRate: number
) {
  if (!showWithRecharge) return price
  return (price * priceRate) / usdExchangeRate
}

export function isSeedancePricingModel(
  model: PricingModel
): model is PricingModel & { seedance: SeedancePublicPricing } {
  return model.billing_mode === 'seedance' && Boolean(model.seedance)
}

export function formatSeedancePerSecond(
  usd: number | undefined,
  options: {
    showWithRecharge?: boolean
    priceRate?: number
    usdExchangeRate?: number
    groupRatio?: number
  } = {}
) {
  if (typeof usd !== 'number' || !Number.isFinite(usd) || usd < 0) {
    return ''
  }
  const groupRatio = options.groupRatio ?? 1
  const price = applyRechargeRate(
    usd * groupRatio,
    options.showWithRecharge ?? false,
    options.priceRate ?? 1,
    options.usdExchangeRate ?? 1
  )
  return formatCurrencyFromUSD(price, {
    digitsLarge: 4,
    digitsSmall: 6,
    abbreviate: false,
  })
}

export function getSeedancePrimaryPerSecond(
  model: PricingModel,
  selectedGroup?: string
) {
  if (!isSeedancePricingModel(model)) return undefined
  const groupRatio = getDisplayGroupRatio(model, selectedGroup)
  const table = model.seedance.super_resolution
    ? model.seedance.output_text_per_second_usd
    : model.seedance.text_per_second_usd
  const usd = table?.['720p'] ?? table?.['1080p'] ?? table?.['480p']
  return {
    usd,
    groupRatio,
    superResolution: Boolean(model.seedance.super_resolution),
  }
}

export function seedanceDisplayResolutions(model: PricingModel) {
  if (!isSeedancePricingModel(model)) return []
  if (model.seedance.super_resolution) {
    return [...SEEDANCE_SR_OUTPUT_RESOLUTIONS]
  }
  return SEEDANCE_OUTPUT_RESOLUTIONS.filter(
    (resolution) =>
      model.seedance.text_per_second_usd?.[resolution] != null ||
      model.seedance.video_per_second_usd?.[resolution] != null
  )
}
