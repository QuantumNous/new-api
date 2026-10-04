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
import type { BillingUsageSchema } from '../../types'
import { compileBillingExpression } from './parser'
import { evaluateBillingCondition } from './runtime'
import {
  TIME_FUNCTIONS,
  expressionDependencies,
  type ExpressionNode,
  type CompiledBillingExpression,
  type TokenVariable,
} from './types'

export type TokenTierCondition = {
  var: 'p' | 'c' | 'len'
  op: '<' | '<=' | '>' | '>='
  value: number
}
export type TokenTier = {
  label: string
  conditions: TokenTierCondition[]
  prices: Partial<Record<TokenVariable, number>>
}
export type TimeTokenTier = TokenTier & {
  conditionText: string
  timeConditions: { condition: ExpressionNode; matches: boolean }[]
}

export function flattenBinary(
  node: ExpressionNode,
  operator: string
): ExpressionNode[] {
  if (node.kind !== 'binary' || node.operator !== operator) return [node]
  return [
    ...flattenBinary(node.left, operator),
    ...flattenBinary(node.right, operator),
  ]
}

function tokenConditions(node: ExpressionNode): TokenTierCondition[] | null {
  const conditions: TokenTierCondition[] = []
  for (const part of flattenBinary(node, '&&')) {
    if (
      part.kind !== 'binary' ||
      !['<', '<=', '>', '>='].includes(part.operator) ||
      part.left.kind !== 'variable' ||
      !['p', 'c', 'len'].includes(part.left.name) ||
      part.right.kind !== 'literal' ||
      typeof part.right.value !== 'number' ||
      part.right.value < 0
    ) {
      return null
    }
    conditions.push({
      var: part.left.name as TokenTierCondition['var'],
      op: part.operator as TokenTierCondition['op'],
      value: part.right.value,
    })
  }
  return conditions
}

function nonnegativePriceLiteral(node: ExpressionNode): number | null {
  if (
    node.kind === 'literal' &&
    typeof node.value === 'number' &&
    node.value >= 0
  ) {
    return node.value
  }
  if (
    node.kind === 'unary' &&
    node.operator === '-' &&
    node.operand.kind === 'literal' &&
    node.operand.value === 0
  ) {
    return -0
  }
  return null
}

function tokenTier(
  node: ExpressionNode,
  conditions: TokenTierCondition[]
): TokenTier | null {
  if (
    node.kind !== 'call' ||
    node.name !== 'tier' ||
    node.args[0]?.kind !== 'literal' ||
    typeof node.args[0].value !== 'string'
  ) {
    return null
  }
  const prices: TokenTier['prices'] = {}
  for (const term of flattenBinary(node.args[1], '+')) {
    if (
      term.kind !== 'binary' ||
      term.operator !== '*' ||
      term.left.kind !== 'variable' ||
      term.left.name === 'len' ||
      nonnegativePriceLiteral(term.right) === null ||
      Object.hasOwn(prices, term.left.name)
    ) {
      return null
    }
    prices[term.left.name] = nonnegativePriceLiteral(term.right) ?? 0
  }
  if (Object.keys(prices).length === 0) return null
  return { label: node.args[0].value, conditions, prices }
}

/** Legacy token summary contract: ordered linear chain, never a minimum or partial price extraction. */
export function readTokenTierChain(node: ExpressionNode): TokenTier[] | null {
  const tiers: TokenTier[] = []
  let remaining = node
  while (remaining.kind === 'conditional') {
    const conditions = tokenConditions(remaining.condition)
    if (!conditions) return null
    const tier = tokenTier(remaining.yes, conditions)
    if (!tier) return null
    tiers.push(tier)
    remaining = remaining.no
  }
  const fallback = tokenTier(remaining, [])
  if (!fallback) return null
  return [...tiers, fallback]
}

export function isTimeCondition(node: ExpressionNode): boolean {
  const dependencies = expressionDependencies(node)
  return (
    dependencies.variables.size === 0 &&
    [...dependencies.functions].some((name) =>
      (TIME_FUNCTIONS as readonly string[]).includes(name)
    ) &&
    [...dependencies.functions].every((name) =>
      [...TIME_FUNCTIONS, 'min', 'max', 'abs', 'ceil', 'floor'].includes(name)
    )
  )
}

function timeTierBranches(
  compiled: CompiledBillingExpression,
  node: ExpressionNode,
  path: TimeTokenTier['timeConditions']
): TimeTokenTier[] | null {
  if (node.kind === 'conditional' && isTimeCondition(node.condition)) {
    const yes = timeTierBranches(compiled, node.yes, [
      ...path,
      { condition: node.condition, matches: true },
    ])
    const no = timeTierBranches(compiled, node.no, [
      ...path,
      { condition: node.condition, matches: false },
    ])
    if (!yes || !no) return null
    return [...yes, ...no]
  }
  const tiers = readTokenTierChain(node)
  if (!tiers || path.length === 0) return null
  const timeDescription = path
    .map(({ condition, matches }) => {
      const source = compiled.source.slice(condition.start, condition.end)
      return matches ? `(${source})` : `!(${source})`
    })
    .join(' && ')
  return tiers.map((tier) => ({
    ...tier,
    timeConditions: path,
    conditionText: [
      timeDescription,
      ...tier.conditions.map(
        (condition) => `${condition.var} ${condition.op} ${condition.value}`
      ),
    ].join(' && '),
  }))
}

export function readTimeTokenPricing(
  source: string,
  now?: Date
): { tiers: TimeTokenTier[]; currentTiers: TimeTokenTier[] } | null {
  const compiled = compileBillingExpression(source)
  if (compiled.status !== 'ready') return null
  const tiers = timeTierBranches(compiled, compiled.ast, [])
  if (!tiers) return null
  const currentTiers = now
    ? tiers.filter((tier) =>
        tier.timeConditions.every(
          ({ condition, matches }) =>
            evaluateBillingCondition(compiled, condition, now) === matches
        )
      )
    : []
  return { tiers, currentTiers }
}

export type TaskTier = {
  label: string
  conditions: { field: string; value: string }[]
  constant: number
  unitPrices: Record<string, number>
}

function taskConditions(
  node: ExpressionNode,
  schema: BillingUsageSchema,
  includeBoolean: boolean
): TaskTier['conditions'] | null {
  const conditions: TaskTier['conditions'] = []
  for (const term of flattenBinary(node, '&&')) {
    if (
      term.kind !== 'binary' ||
      term.operator !== '==' ||
      term.left.kind !== 'call' ||
      term.left.name !== 'u' ||
      term.left.args[0].kind !== 'literal' ||
      typeof term.left.args[0].value !== 'string' ||
      term.right.kind !== 'literal'
    ) {
      return null
    }
    const field = term.left.args[0].value
    const definition = schema[field]
    const value = term.right.value
    if (definition?.type === 'boolean') {
      if (!includeBoolean || typeof value !== 'boolean') return null
    } else if (
      typeof value !== 'string' ||
      !definition?.enum?.includes(value)
    ) {
      return null
    }
    conditions.push({ field, value: String(value) })
  }
  return conditions
}

function taskTier(
  node: ExpressionNode,
  conditions: TaskTier['conditions'],
  schema: BillingUsageSchema
): TaskTier | null {
  if (
    node.kind !== 'call' ||
    node.name !== 'tier' ||
    node.args[0].kind !== 'literal' ||
    typeof node.args[0].value !== 'string'
  ) {
    return null
  }
  let constant = 0
  let hasConstant = false
  const unitPrices: Record<string, number> = {}
  for (let term of flattenBinary(node.args[1], '+')) {
    const literal = nonnegativePriceLiteral(term)
    if (literal !== null) {
      if (hasConstant) return null
      hasConstant = true
      constant = literal
      continue
    }
    const scaled = term.kind === 'binary' && term.operator === '/'
    if (scaled && term.kind === 'binary') {
      if (term.right.kind !== 'literal' || term.right.value !== 1000000) {
        return null
      }
      term = term.left
    }
    if (
      term.kind !== 'binary' ||
      term.operator !== '*' ||
      term.left.kind !== 'call' ||
      term.left.name !== 'u' ||
      term.left.args[0].kind !== 'literal' ||
      typeof term.left.args[0].value !== 'string' ||
      nonnegativePriceLiteral(term.right) === null
    ) {
      return null
    }
    const field = term.left.args[0].value
    const definition = schema[field]
    if (
      definition?.type !== 'number' ||
      !definition.unit ||
      Object.hasOwn(unitPrices, field)
    ) {
      return null
    }
    if ((definition.unit === 'token') !== scaled) return null
    unitPrices[field] = nonnegativePriceLiteral(term.right) ?? 0
  }
  if (Object.keys(unitPrices).length === 0) return null
  return { label: node.args[0].value, conditions, constant, unitPrices }
}

/** Keep task summaries limited to schema-backed enum tiers and canonical scaled units. */
export function readTaskTierChain(
  node: ExpressionNode,
  schema: BillingUsageSchema,
  includeBoolean: boolean
): TaskTier[] | null {
  const tiers: TaskTier[] = []
  let remaining = node
  while (remaining.kind === 'conditional') {
    const conditions = taskConditions(
      remaining.condition,
      schema,
      includeBoolean
    )
    if (!conditions) return null
    const tier = taskTier(remaining.yes, conditions, schema)
    if (!tier) return null
    tiers.push(tier)
    remaining = remaining.no
  }
  const fallback = taskTier(remaining, [], schema)
  if (!fallback) return null
  return [...tiers, fallback]
}
