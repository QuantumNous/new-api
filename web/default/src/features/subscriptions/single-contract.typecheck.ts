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
  ChangePlanRequest,
  ChangePlanResponse,
  SelfSubscriptionData,
} from './types'

type Assert<T extends true> = T
type Extends<T, U> = T extends U ? true : false

declare const _self: SelfSubscriptionData
declare const changeResponse: ChangePlanResponse

export type _SelfContractIncludesSingleContract = Assert<
  Extends<
    NonNullable<typeof _self.contract>,
    {
      id: number
      status: 'active' | 'grace' | 'ended' | 'needs_attention'
      payment_mode:
        | 'stripe_recurring'
        | 'prepaid'
        | 'balance_one_period'
        | 'external_one_period'
      current_plan_id: number
      pending_plan_id: number
      current_period_end: number
      grace_period_end: number
    }
  >
>

export type _SelfContractIncludesCapabilities = Assert<
  Extends<
    typeof _self.capabilities,
    {
      can_change_plan: boolean
      can_use_stripe_recurring: boolean
      can_use_balance_one_period: boolean
      migration_required: boolean
      migration_blocked_reason?: string
    }
  >
>

export type _SelfContractIncludesMigration = Assert<
  Extends<
    typeof _self.migration,
    {
      required: boolean
      blocked: boolean
      reason?: string
    }
  >
>

export type _ChangePlanRequestShape = Assert<
  Extends<
    ChangePlanRequest,
    {
      plan_id: number
      payment_mode: 'stripe_recurring' | 'prepaid' | 'balance_one_period'
      request_id: string
    }
  >
>

export type _ChangePlanResponseShape = Assert<
  Extends<
    ChangePlanResponse,
    {
      status:
        | 'applied'
        | 'scheduled'
        | 'checkout_required'
        | 'payment_action_required'
      contract: NonNullable<SelfSubscriptionData['contract']>
      intent: {
        request_id: string
        payment_mode:
          | 'stripe_recurring'
          | 'prepaid'
          | 'balance_one_period'
          | 'external_one_period'
      }
      checkout_url?: string
      hosted_invoice_url?: string
    }
  >
>

if (changeResponse.status === 'payment_action_required') {
  changeResponse.hosted_invoice_url?.toString()
}
