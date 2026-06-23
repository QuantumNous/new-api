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

export const AMOUNT_BONUS_LIMIT_INTEGER_MAP_ERROR =
  'Amount bonus limit entries must use positive integer recharge amounts and non-negative integer claim counts'

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0
}

export function getAmountBonusLimitJsonError(value: string): string | null {
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

  const valid = Object.entries(parsed).every(([amount, limit]) => {
    return (
      isPositiveIntegerKey(amount) &&
      typeof limit === 'number' &&
      isNonNegativeInteger(limit)
    )
  })

  return valid ? null : AMOUNT_BONUS_LIMIT_INTEGER_MAP_ERROR
}

export function parseAmountBonusLimitJson(value: string): Record<number, number> {
  const result: Record<number, number> = {}
  for (const [amount, limit] of Object.entries(parseAmountBonusRecord(value))) {
    const amountNumber = Number(amount)
    const limitNumber = Number(limit)
    if (isPositiveInteger(amountNumber) && isNonNegativeInteger(limitNumber)) {
      result[amountNumber] = limitNumber
    }
  }
  return result
}

export function setAmountBonusLimit(
  value: string,
  amount: number,
  limit: number
): string {
  const limits = parseAmountBonusLimitJson(value)
  if (isPositiveInteger(amount)) {
    if (isPositiveInteger(limit)) {
      limits[amount] = limit
    } else {
      // 0 / 非正整数视为「不限」，从配置中移除以保持紧凑。
      delete limits[amount]
    }
  }
  const sortedEntries = Object.entries(limits)
    .map(([a, l]) => [Number(a), l] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([a, l]) => [String(a), l] as const)
  return JSON.stringify(Object.fromEntries(sortedEntries), null, 2)
}

// AmountBonusGroups：充值档位 → 可享该档位赠送的用户组白名单（opt-in 语义）。
// 未配 / 空数组 = 谁都不送；含 "all" = 所有用户组都送；否则仅命中列表内组名才送。
export const AMOUNT_BONUS_GROUP_ALL = 'all'

export const AMOUNT_BONUS_GROUPS_MAP_ERROR =
  'Amount bonus group entries must map positive integer recharge amounts to arrays of non-empty group names'

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export function getAmountBonusGroupsJsonError(value: string): string | null {
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

  const valid = Object.entries(parsed).every(([amount, groups]) => {
    return (
      isPositiveIntegerKey(amount) &&
      isStringArray(groups) &&
      groups.every((group) => group.trim().length > 0)
    )
  })

  return valid ? null : AMOUNT_BONUS_GROUPS_MAP_ERROR
}

export function parseAmountBonusGroupsJson(
  value: string
): Record<number, string[]> {
  const result: Record<number, string[]> = {}
  for (const [amount, groups] of Object.entries(
    parseAmountBonusRecord(value)
  )) {
    const amountNumber = Number(amount)
    if (isPositiveInteger(amountNumber) && isStringArray(groups)) {
      const cleaned = groups
        .map((group) => group.trim())
        .filter((group) => group.length > 0)
      result[amountNumber] = cleaned
    }
  }
  return result
}

// setAmountBonusGroups 写入某档位的白名单。空数组也会被保留（语义为「显式配置为不送」），
// 仅当 amount 非正整数时忽略；档位本身的增删由 amount-bonus 表格驱动，这里只更新组列表。
export function setAmountBonusGroups(
  value: string,
  amount: number,
  groups: string[]
): string {
  const all = parseAmountBonusGroupsJson(value)
  if (isPositiveInteger(amount)) {
    all[amount] = groups
      .map((group) => group.trim())
      .filter((group) => group.length > 0)
  }
  const sortedEntries = Object.entries(all)
    .map(([a, g]) => [Number(a), g] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([a, g]) => [String(a), g] as const)
  return JSON.stringify(Object.fromEntries(sortedEntries), null, 2)
}

// removeAmountBonusGroups 删除某档位的白名单（档位被删除时同步清理，避免孤儿残留）。
export function removeAmountBonusGroups(value: string, amount: number): string {
  const all = parseAmountBonusGroupsJson(value)
  delete all[amount]
  const sortedEntries = Object.entries(all)
    .map(([a, g]) => [Number(a), g] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([a, g]) => [String(a), g] as const)
  return JSON.stringify(Object.fromEntries(sortedEntries), null, 2)
}
