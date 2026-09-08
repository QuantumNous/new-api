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
import { z } from 'zod'

import { agentAccessQueryKey } from '@/features/agents/hooks/use-agent-access'
import {
  agentQueryKeys,
  agentUserQueryKey,
  isRefundableAgentCode,
} from '@/features/agents/lib/workspace'
import type { AgentCode } from '@/features/agents/types'
import { ROLE } from '@/lib/roles'

const positiveInteger = z.number().int().positive()
const statusSchema = z
  .enum([
    'active',
    'disabled',
    'completed',
    'partially_refunded',
    'refunded',
    'unused',
    'used',
    'expired',
    'admin_credit',
    'admin_debit',
    'purchase',
    'refund',
  ])
  .optional()
  .catch(undefined)

export const agentAdminSearchSchema = z
  .object({
    tab: z
      .enum(['agents', 'offers', 'orders', 'codes', 'ledger'])
      .catch('agents')
      .default('agents'),
    p: positiveInteger.catch(1).default(1),
    keyword: z.string().trim().max(100).optional().catch(undefined),
    agent_user_id: positiveInteger.optional().catch(undefined),
    plan_id: positiveInteger.optional().catch(undefined),
    order_id: positiveInteger.optional().catch(undefined),
    status: statusSchema,
  })
  .transform((value) => {
    const search: AgentAdminSearch = { tab: value.tab, p: value.p }
    if (value.keyword) search.keyword = value.keyword
    if (value.agent_user_id) search.agent_user_id = value.agent_user_id
    if (value.plan_id) search.plan_id = value.plan_id
    if (value.order_id) search.order_id = value.order_id
    if (value.status) search.status = value.status
    return search
  })

export type AgentAdminSearch = {
  tab: 'agents' | 'offers' | 'orders' | 'codes' | 'ledger'
  p: number
  keyword?: string
  agent_user_id?: number
  plan_id?: number
  order_id?: number
  status?: z.infer<typeof statusSchema>
}

export function getAgentAdminAccess(role: number | undefined): {
  canRead: boolean
  canMutate: boolean
} {
  const currentRole = role ?? ROLE.GUEST
  return {
    canRead: currentRole >= ROLE.ADMIN,
    canMutate: currentRole >= ROLE.SUPER_ADMIN,
  }
}

export function getAgentSystemSwitchState(input: {
  canMutate: boolean
  hasAuthoritativeStatus: boolean
  statusError: boolean
}): 'hidden' | 'loading' | 'error' | 'ready' {
  if (!input.canMutate) return 'hidden'
  if (input.hasAuthoritativeStatus) return 'ready'
  return input.statusError ? 'error' : 'loading'
}

export type CreditAdjustmentPayload = {
  amount: string
  direction: 'credit' | 'debit'
  reason: string
}

export type CreditAttempt = {
  payload: CreditAdjustmentPayload
  idempotencyKey: string
}

export function createCreditAttempt(
  current: CreditAttempt | undefined,
  payload: CreditAdjustmentPayload,
  createID: () => string = () => crypto.randomUUID()
): CreditAttempt {
  if (
    current &&
    current.payload.amount === payload.amount &&
    current.payload.direction === payload.direction &&
    current.payload.reason === payload.reason
  ) {
    return current
  }
  return { payload: { ...payload }, idempotencyKey: createID() }
}

function parsePointCents(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{0,2}))?$/.exec(value)
  if (!match) throw new Error('invalid point amount')
  const cents =
    BigInt(match[2]) * 100n + BigInt((match[3] ?? '').padEnd(2, '0'))
  return match[1] === '-' ? -cents : cents
}

function formatPointCents(cents: bigint): string {
  const negative = cents < 0n
  const absolute = negative ? -cents : cents
  const units = absolute / 100n
  const fraction = (absolute % 100n).toString().padStart(2, '0')
  return `${negative ? '-' : ''}${units}.${fraction}`
}

export function projectAgentBalance(
  balance: string,
  amount: string,
  direction: 'credit' | 'debit'
): string {
  const balanceCents = parsePointCents(balance)
  const amountCents = parsePointCents(amount)
  const projected =
    direction === 'credit'
      ? balanceCents + amountCents
      : balanceCents - amountCents
  return formatPointCents(projected)
}

export function validateAgentOfferDraft(input: {
  unitPrice: string
  codeValidDays: string
  refundFeeBps: string
}): boolean {
  if (!/^\d+(?:\.\d{0,2})?$/.test(input.unitPrice)) {
    return false
  }
  if (parsePointCents(input.unitPrice) <= 0n) {
    return false
  }
  if (!/^\d+$/.test(input.codeValidDays) || !/^\d+$/.test(input.refundFeeBps)) {
    return false
  }
  const codeValidDays = Number(input.codeValidDays)
  const refundFeeBps = Number(input.refundFeeBps)
  return (
    Number.isSafeInteger(codeValidDays) &&
    codeValidDays >= 1 &&
    codeValidDays <= 3650 &&
    Number.isSafeInteger(refundFeeBps) &&
    refundFeeBps >= 0 &&
    refundFeeBps <= 10_000
  )
}

export function getAdminRefundSelection(
  candidates: AgentCode[],
  nowSeconds: number = Math.floor(Date.now() / 1000)
): {
  agentUserID: number
  redemptionIDs: number[]
} | null {
  const first = candidates[0]
  if (
    !first ||
    first.id <= 0 ||
    first.agent_user_id <= 0 ||
    candidates.length > 100 ||
    !isRefundableAgentCode(first, nowSeconds)
  ) {
    return null
  }
  const redemptionIDs = new Set<number>()
  for (const candidate of candidates) {
    if (
      candidate.id <= 0 ||
      candidate.agent_user_id !== first.agent_user_id ||
      !isRefundableAgentCode(candidate, nowSeconds) ||
      redemptionIDs.has(candidate.id)
    ) {
      return null
    }
    redemptionIDs.add(candidate.id)
  }
  return {
    agentUserID: first.agent_user_id,
    redemptionIDs: [...redemptionIDs],
  }
}

export const agentAdminQueryKeys = {
  root: ['agent-admin'] as const,
  agentsRoot: (scope: number) => ['agent-admin', scope, 'agents'] as const,
  agents: (scope: number, search: AgentAdminSearch) =>
    ['agent-admin', scope, 'agents', search] as const,
  offers: (scope: number) => ['agent-admin', scope, 'offers'] as const,
  plans: (scope: number) =>
    ['agent-admin', scope, 'subscription-plans'] as const,
  orders: (scope: number, search: AgentAdminSearch) =>
    ['agent-admin', scope, 'orders', search] as const,
  ordersRoot: (scope: number) => ['agent-admin', scope, 'orders'] as const,
  codes: (scope: number, search: AgentAdminSearch) =>
    ['agent-admin', scope, 'codes', search] as const,
  codesRoot: (scope: number) => ['agent-admin', scope, 'codes'] as const,
  ledger: (scope: number, userID: number, page: number) =>
    ['agent-admin', scope, 'ledger', userID, page] as const,
  ledgerRoot: (scope: number, userID: number) =>
    ['agent-admin', scope, 'ledger', userID] as const,
  reconciliation: (scope: number, userID: number) =>
    ['agent-admin', scope, 'reconciliation', userID] as const,
}

export type AgentAdminMutationKind =
  | 'offer'
  | 'lifecycle'
  | 'limit'
  | 'credit'
  | 'refund'

export function getAgentAdminInvalidationPlan(
  kind: AgentAdminMutationKind,
  currentUserID: number,
  affectedAgentUserID: number
): readonly (readonly unknown[])[] {
  if (kind === 'offer') {
    return [agentAdminQueryKeys.offers(currentUserID), agentQueryKeys.offers]
  }

  const plan: (readonly unknown[])[] = [
    agentAdminQueryKeys.agentsRoot(currentUserID),
  ]
  if (kind === 'credit' || kind === 'refund') {
    if (kind === 'refund') {
      plan.unshift(
        agentAdminQueryKeys.codesRoot(currentUserID),
        agentAdminQueryKeys.ordersRoot(currentUserID)
      )
    }
    plan.push(
      agentAdminQueryKeys.ledgerRoot(currentUserID, affectedAgentUserID),
      agentAdminQueryKeys.reconciliation(currentUserID, affectedAgentUserID)
    )
  }

  if (currentUserID !== affectedAgentUserID) {
    return plan
  }

  plan.push(agentUserQueryKey(agentQueryKeys.overview, currentUserID))
  if (kind === 'lifecycle') {
    plan.push(agentAccessQueryKey(currentUserID))
  }
  if (kind === 'credit') {
    plan.push(agentUserQueryKey(agentQueryKeys.creditLogs, currentUserID))
  }
  if (kind === 'refund') {
    plan.push(
      agentUserQueryKey(agentQueryKeys.orders, currentUserID),
      agentUserQueryKey(agentQueryKeys.codes, currentUserID),
      agentUserQueryKey(agentQueryKeys.creditLogs, currentUserID)
    )
  }
  return plan
}
