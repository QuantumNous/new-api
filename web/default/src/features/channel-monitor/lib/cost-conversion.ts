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

import type { ChannelMonitorCostConversion } from '../types'

export const CHANNEL_MONITOR_SUBSCRIPTION_DAYS = {
  day: 1,
  week: 7,
  month: 30,
} as const

export function getChannelMonitorConversionFactor(
  config: ChannelMonitorCostConversion
): number | null {
  let factor = 1
  if (config.mode === 'recharge') {
    factor = config.paid_cny / config.credited_usd
  } else if (config.mode === 'subscription') {
    factor =
      config.subscription_price_cny /
      (config.subscription_daily_usd *
        CHANNEL_MONITOR_SUBSCRIPTION_DAYS[config.subscription_period])
  }
  return Number.isFinite(factor) && factor > 0 ? factor : null
}

export function getChannelMonitorCostRatio(
  upstreamRatio: number | null | undefined,
  config: ChannelMonitorCostConversion
): number | null {
  if (upstreamRatio == null || !Number.isFinite(upstreamRatio)) return null
  const factor = getChannelMonitorConversionFactor(config)
  if (factor == null) return null
  const costRatio = upstreamRatio * factor
  return Number.isFinite(costRatio) ? costRatio : null
}
