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
  PlanRecord,
  UserSubscriptionRecord,
} from '@/features/subscriptions/types'

interface BillingSourceVisibilityInput {
  isAdmin: boolean
  /** Admin view: every plan; own-logs view: the enabled public plans. */
  plans: PlanRecord[] | undefined
  /** Own-logs view only: every subscription the user ever held. */
  subscriptions: UserSubscriptionRecord[] | undefined
}

/**
 * Every consume log carries `billing_source`, so the Wallet / Subscription
 * label on the cost column is only a disambiguator. It stays hidden unless the
 * system has at least one enabled plan and, when viewing one's own logs, that
 * user has purchased a subscription.
 */
export function shouldShowBillingSource(
  input: BillingSourceVisibilityInput
): boolean {
  const hasEnabledPlan = (input.plans ?? []).some(
    (record) => record.plan?.enabled === true
  )
  if (!hasEnabledPlan) {
    return false
  }
  if (input.isAdmin) {
    return true
  }
  return (input.subscriptions?.length ?? 0) > 0
}
