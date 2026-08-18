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
// Backend ratios use a $2 / 1M-token reference price. Seedance's official
// table is denominated in RMB, so the model editor performs the same 7.3
// RMB/USD conversion used by setting/ratio_setting/model_ratio.go.
export const SEEDANCE_RMB_PER_USD = 7.3
export const MODEL_RATIO_REFERENCE_USD = 2

export function isSeedanceModel(modelName: string): boolean {
  return /seedance/i.test(modelName.trim())
}

export function seedanceBasePriceRmbToModelRatio(priceRmb: number): number {
  return priceRmb / SEEDANCE_RMB_PER_USD / MODEL_RATIO_REFERENCE_USD
}

export function modelRatioToSeedanceBasePriceRmb(ratio: number): number {
  return ratio * MODEL_RATIO_REFERENCE_USD * SEEDANCE_RMB_PER_USD
}
