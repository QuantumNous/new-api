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
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const userSubscriptionsDialogSource = readFileSync(
  new URL(
    './components/dialogs/user-subscriptions-dialog.tsx',
    import.meta.url
  ),
  'utf8'
)
const mutateDrawerSource = readFileSync(
  new URL('./components/subscriptions-mutate-drawer.tsx', import.meta.url),
  'utf8'
)

describe('subscription admin lifecycle guards', () => {
  test('keeps entitlement history free of legacy mutations', () => {
    for (const legacyMutation of [
      'createUserSubscription',
      'invalidateUserSubscription',
      'deleteUserSubscription',
    ]) {
      expect(userSubscriptionsDialogSource).not.toContain(legacyMutation)
    }

    expect(userSubscriptionsDialogSource).not.toContain("t('Add subscription')")
    expect(userSubscriptionsDialogSource).not.toContain("t('Invalidate')")
    expect(userSubscriptionsDialogSource).not.toContain("t('Delete')")
  })

  test('validates Stripe recurring mode and Stripe Price ID in both directions', () => {
    expect(mutateDrawerSource).toMatch(
      /paymentModes\.includes\('stripe_recurring'\)\s*&&\s*!values\.stripe_price_id\?\.trim\(\)/
    )
    expect(mutateDrawerSource).toMatch(
      /values\.stripe_price_id\?\.trim\(\)\s*&&\s*!paymentModes\.includes\('stripe_recurring'\)/
    )
  })

  test('renders admin local price inputs for Pix and UPI', () => {
    expect(mutateDrawerSource).toContain("name='pix_price_brl'")
    expect(mutateDrawerSource).toContain("t('Pix monthly price (BRL)')")
    expect(mutateDrawerSource).toContain("name='upi_price_inr'")
    expect(mutateDrawerSource).toContain("t('UPI monthly price (INR)')")
  })

  test('derives payment modes without treating payment_modes as persisted plan data', () => {
    expect(mutateDrawerSource).not.toContain('payment_modes')
  })

  test('uses canonical admin lifecycle response instead of inferring from legacy rows', () => {
    const apiSource = readFileSync(new URL('./api.ts', import.meta.url), 'utf8')

    expect(apiSource).toContain('AdminUserSubscriptionsResponse')
    expect(apiSource).toContain(
      'Promise<ApiResponse<AdminUserSubscriptionsResponse>>'
    )
    expect(apiSource).not.toContain(
      'Promise<ApiResponse<UserSubscriptionRecord[]>>'
    )

    expect(userSubscriptionsDialogSource).toContain('current_entitlement')
    expect(userSubscriptionsDialogSource).toContain('current_binding')
    expect(userSubscriptionsDialogSource).toContain('pending_change')
    expect(userSubscriptionsDialogSource).toContain('current_period')
    expect(userSubscriptionsDialogSource).toContain('adminLifecycle?.quota')
    expect(userSubscriptionsDialogSource).toContain('migration')
    expect(userSubscriptionsDialogSource).toContain('history')
    expect(userSubscriptionsDialogSource).not.toContain(
      'as AdminUserSubscriptionRecord[]'
    )
    expect(userSubscriptionsDialogSource).not.toContain(
      'function isCurrentEntitlement'
    )
  })

  test('renders canonical current period and quota fields', () => {
    for (const canonicalField of [
      'adminLifecycle?.current_period.start',
      'adminLifecycle?.current_period.end',
      'adminLifecycle?.quota.amount_total',
      'adminLifecycle?.quota.amount_used',
      'adminLifecycle?.quota.amount_remaining',
      'adminLifecycle?.quota.unlimited',
    ]) {
      expect(userSubscriptionsDialogSource).toContain(canonicalField)
    }

    for (const label of [
      "t('Start')",
      "t('End')",
      "t('Grace Period')",
      "t('Total Quota')",
      "t('Used')",
      "t('Remaining')",
      "t('Unlimited')",
    ]) {
      expect(userSubscriptionsDialogSource).toContain(label)
    }
  })
})
