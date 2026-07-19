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
import type {
  LotteryBetPrize,
  LotteryFreePrize,
  LotterySymbol,
} from '../types'

function formatUsd(usd: number): string {
  if (usd === 0) return '$0'
  const digits = Math.abs(usd) < 0.1 ? 4 : 2
  return `$${usd.toFixed(digits)}`
}

export function buildFreeSymbols(prizes: LotteryFreePrize[]): LotterySymbol[] {
  const maxUsd = Math.max(0, ...prizes.map((p) => p.usd))
  return prizes.map((p, index) => {
    let tone: LotterySymbol['tone'] = 'win'
    if (p.is_thanks || p.usd === 0) tone = 'thanks'
    else if (p.usd === maxUsd && maxUsd > 0) tone = 'jackpot'
    return {
      index,
      name: p.name,
      label: p.usd === 0 ? p.name : `+${formatUsd(p.usd)}`,
      tone,
      weight: p.weight,
    }
  })
}

export function buildBetSymbols(prizes: LotteryBetPrize[]): LotterySymbol[] {
  return prizes.map((p, index) => {
    let tone: LotterySymbol['tone'] = 'win'
    if (p.is_thanks || p.multiplier === 0) tone = 'thanks'
    else if (p.multiplier < 0) tone = 'lose'
    else if (p.multiplier >= 2) tone = 'jackpot'

    let label = `${p.multiplier}×`
    if (p.multiplier === 0) {
      label = p.name
    } else if (p.multiplier > 0) {
      label = `×${p.multiplier}`
    }

    return {
      index,
      name: p.name,
      label,
      tone,
      weight: p.weight,
    }
  })
}
