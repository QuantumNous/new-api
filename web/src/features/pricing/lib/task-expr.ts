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
  BillingUsageExample,
  BillingUsageFieldSchema,
  BillingUsageSchema,
} from '../types'

export const TASK_TOKEN_PRICE_SCALE = 1_000_000
import {
  parseTaskTiersFromExpr,
  splitBillingExprAndRequestRules,
} from './billing-expr'

export type TaskVisualCondition = {
  field: string
  value: string
}

export type TaskVisualTier = {
  label: string
  conditions: TaskVisualCondition[]
  constant: number
  unitPrices: Record<string, number>
}

export type TaskVisualConfig = {
  tiers: TaskVisualTier[]
}

export type TaskMatrixRow = {
  combination: Record<string, string>
  constant: number
  unitPrices: Record<string, number>
}

export type TaskMatrixConfig = {
  rows: TaskMatrixRow[]
}

export type TaskPreviewResult = {
  tier: TaskVisualTier
  total: number
  parts: {
    kind: 'constant' | 'usage'
    field?: string
    amount: number
    quantity?: number
    unitPrice?: number
  }[]
}

export function getTaskNumberFields(
  schema: BillingUsageSchema | null | undefined
): [string, BillingUsageFieldSchema][] {
  if (!schema) return []
  return Object.entries(schema)
    .filter((entry) => entry[1].type === 'number' && Boolean(entry[1].unit))
    .sort(([left], [right]) => left.localeCompare(right))
}

export function getTaskEnumFields(
  schema: BillingUsageSchema | null | undefined
): [string, BillingUsageFieldSchema][] {
  if (!schema) return []
  return Object.entries(schema)
    .filter((entry) => Boolean(entry[1].enum?.length))
    .sort(([left], [right]) => left.localeCompare(right))
}

export function getTaskEnumCombinations(
  schema: BillingUsageSchema | null | undefined
): Record<string, string>[] {
  let combinations: Record<string, string>[] = [{}]
  for (const [field, definition] of getTaskEnumFields(schema)) {
    const nextCombinations: Record<string, string>[] = []
    for (const combination of combinations) {
      for (const value of definition.enum ?? []) {
        nextCombinations.push({ ...combination, [field]: value })
      }
    }
    combinations = nextCombinations
  }
  return combinations
}

export function createDefaultTaskVisualConfig(
  schema: BillingUsageSchema
): TaskVisualConfig {
  return {
    tiers: [
      {
        label: 'base',
        conditions: [],
        constant: 0,
        unitPrices: Object.fromEntries(
          getTaskNumberFields(schema).map(([field]) => [field, 0])
        ),
      },
    ],
  }
}

export function createDefaultTaskMatrixConfig(
  schema: BillingUsageSchema
): TaskMatrixConfig {
  const unitPrices = Object.fromEntries(
    getTaskNumberFields(schema).map(([field]) => [field, 0])
  )
  return {
    rows: getTaskEnumCombinations(schema).map((combination) => ({
      combination,
      constant: 0,
      unitPrices: { ...unitPrices },
    })),
  }
}

export function taskMatrixRowLabel(
  combination: Record<string, string>
): string {
  const values = Object.entries(combination)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value)
  return values.length > 0 ? values.join('·') : 'base'
}

function taskMatrixCombinationKey(
  combination: Record<string, string>,
  enumFields: [string, BillingUsageFieldSchema][]
): string {
  return JSON.stringify(enumFields.map(([field]) => combination[field]))
}

export function taskMatrixToTiers(
  config: TaskMatrixConfig,
  schema: BillingUsageSchema
): TaskVisualTier[] {
  const numberFields = getTaskNumberFields(schema)
  const firstRow = config.rows[0]
  if (numberFields.length === 0 || !firstRow) return []

  const isUniform = config.rows.every(
    (row) =>
      row.constant === firstRow.constant &&
      numberFields.every(
        ([field]) => row.unitPrices[field] === firstRow.unitPrices[field]
      )
  )
  if (isUniform) {
    return [
      {
        label: 'base',
        conditions: [],
        constant: firstRow.constant,
        unitPrices: Object.fromEntries(
          numberFields.map(([field]) => [
            field,
            firstRow.unitPrices[field] ?? 0,
          ])
        ),
      },
    ]
  }

  return config.rows.map((row, index) => ({
    label: taskMatrixRowLabel(row.combination),
    conditions:
      index === config.rows.length - 1
        ? []
        : Object.entries(row.combination)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([field, value]) => ({ field, value })),
    constant: row.constant,
    unitPrices: Object.fromEntries(
      numberFields.map(([field]) => [field, row.unitPrices[field] ?? 0])
    ),
  }))
}

export function tryParseTaskMatrixConfig(
  expression: string | null | undefined,
  schema: BillingUsageSchema
): TaskMatrixConfig | null {
  if (!expression) return null
  const tiers = parseTaskTiersFromExpr(expression, schema)
  if (tiers.length === 0) return null

  const enumFields = getTaskEnumFields(schema)
  const numberFields = getTaskNumberFields(schema)
  const combinations = getTaskEnumCombinations(schema)

  if (tiers.length === 1 && tiers[0].conditions.length === 0) {
    return {
      rows: combinations.map((combination) => ({
        combination,
        constant: tiers[0].constant,
        unitPrices: Object.fromEntries(
          numberFields.map(([field]) => [
            field,
            tiers[0].unitPrices[field] ?? 0,
          ])
        ),
      })),
    }
  }

  if (tiers.length !== combinations.length) return null
  const fallbackTier = tiers.at(-1)
  if (!fallbackTier || fallbackTier.conditions.length !== 0) return null

  const tiersByCombination = new Map<string, (typeof tiers)[number]>()
  for (const tier of tiers.slice(0, -1)) {
    if (tier.conditions.length !== enumFields.length) return null

    const valuesByField = new Map<string, string>()
    for (const condition of tier.conditions) {
      const definition = schema[condition.field]
      if (
        valuesByField.has(condition.field) ||
        !definition?.enum?.includes(condition.value)
      ) {
        return null
      }
      valuesByField.set(condition.field, condition.value)
    }
    if (valuesByField.size !== enumFields.length) return null

    const combination = Object.fromEntries(
      enumFields.map(([field]) => [field, valuesByField.get(field) ?? ''])
    )
    const key = taskMatrixCombinationKey(combination, enumFields)
    if (tiersByCombination.has(key)) return null
    tiersByCombination.set(key, tier)
  }

  const missingCombinations = combinations.filter(
    (combination) =>
      !tiersByCombination.has(taskMatrixCombinationKey(combination, enumFields))
  )
  if (missingCombinations.length !== 1) return null
  tiersByCombination.set(
    taskMatrixCombinationKey(missingCombinations[0], enumFields),
    fallbackTier
  )

  const rows: TaskMatrixRow[] = []
  for (const combination of combinations) {
    const tier = tiersByCombination.get(
      taskMatrixCombinationKey(combination, enumFields)
    )
    if (!tier) return null
    rows.push({
      combination,
      constant: tier.constant,
      unitPrices: Object.fromEntries(
        numberFields.map(([field]) => [field, tier.unitPrices[field] ?? 0])
      ),
    })
  }
  return { rows }
}

export function evaluateTaskVisualConfig(
  config: TaskVisualConfig,
  sample: Record<string, number | string>,
  schema?: BillingUsageSchema
): TaskPreviewResult | null {
  const fallback = config.tiers.at(-1)
  if (!fallback) return null

  let matchedTier = fallback
  for (const tier of config.tiers.slice(0, -1)) {
    const matches = tier.conditions.every(
      (condition) => sample[condition.field] === condition.value
    )
    if (matches) {
      matchedTier = tier
      break
    }
  }

  const constant = Number(matchedTier.constant)
  if (!Number.isFinite(constant) || constant < 0) return null

  const parts: TaskPreviewResult['parts'] = []
  let total = 0
  if (constant > 0) {
    parts.push({ kind: 'constant', amount: constant })
    total += constant
  }

  for (const [field, rawUnitPrice] of Object.entries(matchedTier.unitPrices)) {
    const unitPrice = Number(rawUnitPrice)
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return null
    if (unitPrice === 0) continue

    const quantity = Number(sample[field])
    if (!Number.isFinite(quantity) || quantity < 0) return null
    const amount =
      schema?.[field]?.unit === 'token'
        ? (quantity * unitPrice) / TASK_TOKEN_PRICE_SCALE
        : quantity * unitPrice
    if (!Number.isFinite(amount)) return null
    parts.push({ kind: 'usage', field, amount, quantity, unitPrice })
    total += amount
  }

  if (!Number.isFinite(total)) return null
  return { tier: matchedTier, total, parts }
}

export function evaluateTaskUsageExamples(
  expression: string | null | undefined,
  schema: BillingUsageSchema | null | undefined,
  examples: BillingUsageExample[] | null | undefined
): { label: string; total: number }[] {
  if (!expression || !schema || !examples?.length) return []
  const { billingExpr } = splitBillingExprAndRequestRules(expression)
  const config = tryParseTaskVisualConfig(billingExpr, schema)
  if (!config) return []
  const rows: { label: string; total: number }[] = []
  for (const example of examples) {
    const result = evaluateTaskVisualConfig(config, example.facts, schema)
    if (!result) continue
    rows.push({ label: example.label, total: result.total })
  }
  return rows
}

export function normalizeTaskVisualConfig(
  config: TaskVisualConfig | null | undefined,
  schema: BillingUsageSchema
): TaskVisualConfig {
  if (!config?.tiers?.length) return createDefaultTaskVisualConfig(schema)
  const numberFields = new Set(
    getTaskNumberFields(schema).map(([field]) => field)
  )
  const enumFields = new Map(
    getTaskEnumFields(schema).map(([field, definition]) => [
      field,
      definition.enum ?? [],
    ])
  )

  return {
    tiers: config.tiers.map((tier, index) => {
      const unitPrices = Object.fromEntries(
        [...numberFields].map((field) => {
          const value = Number(tier.unitPrices?.[field])
          return [field, Number.isFinite(value) && value >= 0 ? value : 0]
        })
      )
      const constant = Number(tier.constant)
      return {
        label: tier.label || (index === 0 ? 'base' : `tier_${index + 1}`),
        conditions: (tier.conditions ?? []).filter((condition) =>
          enumFields.get(condition.field)?.includes(condition.value)
        ),
        constant: Number.isFinite(constant) && constant >= 0 ? constant : 0,
        unitPrices,
      }
    }),
  }
}

function generateTaskTierBody(
  tier: TaskVisualTier,
  numberFields: [string, BillingUsageFieldSchema][]
): string {
  const parts: string[] = []
  if (tier.constant > 0) parts.push(String(tier.constant))
  for (const [field, definition] of numberFields) {
    const price = tier.unitPrices[field] ?? 0
    if (definition.unit === 'token') {
      parts.push(
        `u(${JSON.stringify(field)}) * ${price} / ${TASK_TOKEN_PRICE_SCALE}`
      )
      continue
    }
    parts.push(`u(${JSON.stringify(field)}) * ${price}`)
  }
  return parts.join(' + ')
}

function generateTaskTierCall(
  tier: TaskVisualTier,
  numberFields: [string, BillingUsageFieldSchema][]
): string {
  return `tier(${JSON.stringify(tier.label)}, ${generateTaskTierBody(tier, numberFields)})`
}

function generateTaskCondition(conditions: TaskVisualCondition[]): string {
  return conditions
    .map(
      (condition) =>
        `u(${JSON.stringify(condition.field)}) == ${JSON.stringify(condition.value)}`
    )
    .join(' && ')
}

export function generateTaskExprFromConfig(
  config: TaskVisualConfig | null | undefined,
  schema: BillingUsageSchema
): string {
  const numberFields = getTaskNumberFields(schema)
  if (numberFields.length === 0) return ''
  const normalized = normalizeTaskVisualConfig(config, schema)
  if (normalized.tiers.length === 1) {
    return generateTaskTierCall(normalized.tiers[0], numberFields)
  }

  const parts: string[] = []
  for (let index = 0; index < normalized.tiers.length; index += 1) {
    const tier = normalized.tiers[index]
    const call = generateTaskTierCall(tier, numberFields)
    if (index === normalized.tiers.length - 1) {
      parts.push(call)
      continue
    }
    const condition = generateTaskCondition(tier.conditions)
    if (!condition) return ''
    parts.push(`${condition} ? ${call}`)
  }
  return parts.join(' : ')
}

export function tryParseTaskVisualConfig(
  expression: string | null | undefined,
  schema: BillingUsageSchema
): TaskVisualConfig | null {
  if (!expression) return null
  const tiers = parseTaskTiersFromExpr(expression, schema)
  if (tiers.length === 0) return null
  return normalizeTaskVisualConfig(
    {
      tiers: tiers.map((tier) => ({
        label: tier.label,
        conditions: tier.conditions,
        constant: tier.constant,
        unitPrices: tier.unitPrices,
      })),
    },
    schema
  )
}
