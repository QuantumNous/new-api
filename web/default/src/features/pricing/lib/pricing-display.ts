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
import type { TFunction } from 'i18next'
import { normalizeBillingDisplayString } from '@/lib/ops-billing-display'
import type { TokenUnit } from '../types'

/** User-visible unit suffix after a billing unit price (not raw M/K). */
export function getPricingTokenUnitSuffix(
  t: TFunction,
  tokenUnit: TokenUnit
): string {
  return tokenUnit === 'K'
    ? t(' / thousand tokens')
    : t(' / million tokens')
}

/** Toolbar segment label for token unit selector. */
export function getPricingTokenUnitSegmentLabel(
  t: TFunction,
  tokenUnit: TokenUnit
): string {
  return tokenUnit === 'K' ? t('Thousand tokens') : t('Per million tokens')
}

/** Normalize legacy $/USD strings from formatCurrencyFromUSD for pricing pages. */
export function formatPricingDisplayAmount(raw: string): string {
  return normalizeBillingDisplayString(raw)
}
