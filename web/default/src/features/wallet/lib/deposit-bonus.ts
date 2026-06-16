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

// Deposit-bonus tiers (充X送Y). Must mirror the backend depositBonusTiers in
// model/topup.go — paying exactly one of these USD amounts grants the listed bonus USD.
// Custom amounts get no bonus.
export const DEPOSIT_BONUS_TIERS: Record<number, number> = {
  10: 2,
  20: 5,
  50: 15,
  100: 35,
  200: 100,
  1000: 500,
}

/** Returns the bonus USD for a paid amount, or 0 if the amount is not an eligible tier. */
export function depositBonusUsd(paidAmount: number): number {
  return DEPOSIT_BONUS_TIERS[paidAmount] ?? 0
}
