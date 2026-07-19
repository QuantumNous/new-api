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

export type LotteryFreePrize = {
  name: string
  usd: number
  weight: number
  is_thanks: boolean
}

export type LotteryBetPrize = {
  name: string
  multiplier: number
  weight: number
  is_thanks: boolean
}

export type LotteryTodayDraw = {
  prize_name: string
  prize_index: number
  quota_delta: number
  usd_delta: number
  bet_quota: number
  bet_usd: number
  is_thanks: boolean
  is_pity: boolean
  is_thursday: boolean
  draw_date: string
}

export type LotteryStatus = {
  enabled: boolean
  can_draw: boolean
  /** Whether the user may play under the redemption-code gate. */
  meets_redemption_requirement: boolean
  /** When true, non-Thursday draws require at least one redeemed code. */
  require_redemption: boolean
  is_crazy_thursday: boolean
  /** User-facing marketing pool (not the real payout cap). */
  display_daily_pool_usd: number
  effective_display_daily_pool_usd: number
  min_bet_usd: number
  max_bet_usd: number
  user_quota: number
  user_usd: number
  quota_per_unit: number
  thanks_streak: number
  pity_threshold: number
  free_prizes: LotteryFreePrize[]
  bet_prizes: LotteryBetPrize[]
  today_draw: LotteryTodayDraw | null
}

export type LotteryDrawResult = {
  prize_index: number
  prize_name: string
  quota_delta: number
  usd_delta: number
  bet_quota: number
  bet_usd: number
  is_thanks: boolean
  is_pity: boolean
  is_thursday: boolean
  remaining_pool: number
  remaining_pool_usd: number
  draw_date: string
}

export type LotterySymbol = {
  index: number
  name: string
  label: string
  tone: 'thanks' | 'win' | 'lose' | 'jackpot'
  weight: number
}
