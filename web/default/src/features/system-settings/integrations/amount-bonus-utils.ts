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
import { safeJsonParseWithValidation } from '../utils/json-parser'
import { isObjectRecord } from '../utils/json-validators'

export const AMOUNT_BONUS_INTEGER_MAP_ERROR =
  'Amount bonus entries must use positive integer recharge amounts and positive integer bonus amounts'

export type AmountBonusTier = {
  amount: number
  bonusAmount: number
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

function isPositiveIntegerKey(value: string): boolean {
  return /^[1-9]\d*$/.test(value)
}

function parseAmountBonusRecord(value: string): Record<string, unknown> {
  return safeJsonParseWithValidation<Record<string, unknown>>(value, {
    fallback: {},
    validator: isObjectRecord,
    silent: true,
  })
}

export function getAmountBonusJsonError(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid JSON'
  }

  if (!isObjectRecord(parsed)) {
    return 'JSON structure is invalid'
  }

  const entries = Object.entries(parsed)
  const valid = entries.every(([amount, bonusAmount]) => {
    return (
      isPositiveIntegerKey(amount) &&
      typeof bonusAmount === 'number' &&
      isPositiveInteger(bonusAmount)
    )
  })

  return valid ? null : AMOUNT_BONUS_INTEGER_MAP_ERROR
}

export function parseAmountBonusJson(value: string): AmountBonusTier[] {
  return Object.entries(parseAmountBonusRecord(value))
    .map(([amount, bonusAmount]) => ({
      amount: Number(amount),
      bonusAmount: Number(bonusAmount),
    }))
    .filter(
      (tier) =>
        isPositiveInteger(tier.amount) && isPositiveInteger(tier.bonusAmount)
    )
    .sort((a, b) => a.amount - b.amount)
}

export function serializeAmountBonusTiers(tiers: AmountBonusTier[]): string {
  const sortedEntries = tiers
    .filter(
      (tier) =>
        isPositiveInteger(tier.amount) && isPositiveInteger(tier.bonusAmount)
    )
    .sort((a, b) => a.amount - b.amount)
    .map((tier) => [String(tier.amount), tier.bonusAmount] as const)

  return JSON.stringify(Object.fromEntries(sortedEntries), null, 2)
}

export function upsertAmountBonusTier(
  value: string,
  editData: AmountBonusTier | null,
  data: AmountBonusTier
): string {
  const tiers = parseAmountBonusJson(value).filter((tier) => {
    if (tier.amount === data.amount) {
      return false
    }
    return !editData || tier.amount !== editData.amount
  })

  return serializeAmountBonusTiers([...tiers, data])
}
