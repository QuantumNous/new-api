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
  resolveHwDisplayOverride,
  type HwDisplayOverride,
} from '@/features/hw/lib/currency'
import { formatBillingCurrencyFromUSD } from '@/lib/currency'

/**
 * Model prices follow the currency switch in the header. The switch drives
 * every console amount in `lib/currency.ts`, so these are the shared names;
 * `usePricingCurrency` keeps the override so a price re-renders on a switch.
 */
export type PricingCurrencyOverride = HwDisplayOverride

/** The EUR/USD override of the chosen currency, or null to use the console setting. */
export const resolvePricingCurrencyOverride = resolveHwDisplayOverride

/**
 * `formatBillingCurrencyFromUSD` for model prices: the currency chosen with
 * the header switch (EUR/USD), otherwise the console display currency.
 */
export const formatPricingCurrencyFromUSD = formatBillingCurrencyFromUSD
