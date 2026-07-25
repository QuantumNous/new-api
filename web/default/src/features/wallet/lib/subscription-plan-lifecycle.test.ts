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
import type {
  SelfSubscriptionDataResponse,
  SubscriptionPaymentMode,
  SubscriptionPlan,
} from '@/features/subscriptions/types'
import type { TopupInfo } from '../types'
import {
  type WalletSelfSubscriptionData,
  buildFlexiblePurchaseRequest,
  getFlexiblePlanAction,
  getDisplayedPlanAction,
  getAllowedPaymentModes,
  normalizeSelfSubscriptionData,
} from './subscription-plan-lifecycle'

const stripeTopupInfo = {
  enable_online_topup: true,
  enable_stripe_topup: true,
  pay_methods: [],
  min_topup: 0,
  stripe_min_topup: 0,
  amount_options: [],
  discount: {},
  bonus: {},
} satisfies TopupInfo

const enabledCapabilities = {
  can_change_plan: true,
  can_use_stripe_recurring: true,
  can_use_balance_one_period: true,
  can_cancel: false,
  can_resume: false,
  requires_support: false,
  has_pending_intent: false,
  is_grace: false,
  is_cancel_at_period_end: false,
  has_migration_conflict: false,
  migration_required: false,
} satisfies WalletSelfSubscriptionData['capabilities']

const basePlan = {
  id: 1,
  title: 'Pro',
  price_amount: 20,
  currency: 'USD',
  duration_unit: 'month',
  duration_value: 1,
  quota_reset_period: 'monthly',
  enabled: true,
  sort_order: 1,
  allow_balance_pay: true,
  max_purchase_per_user: 0,
  total_amount: 100,
} satisfies SubscriptionPlan

function createBackendSelfData(
  requiresAdminReview: boolean,
  hasMigrationConflict: boolean
): SelfSubscriptionDataResponse {
  return {
    billing_preference: 'subscription_first',
    capabilities: {
      can_change_plan: true,
      can_use_stripe_recurring: true,
      can_use_balance_one_period: true,
      has_migration_conflict: hasMigrationConflict,
    },
    migration: {
      requires_admin_review: requiresAdminReview,
      classification: requiresAdminReview ? 'requires_review' : 'no_active',
      reason: requiresAdminReview ? 'administrator review required' : '',
    },
    subscriptions: [],
    all_subscriptions: [],
    recurring_subscriptions: [],
  }
}

function createCanonicalLifecycleWithContract(
  paymentMode: SubscriptionPaymentMode
): WalletSelfSubscriptionData {
  return normalizeSelfSubscriptionData({
    ...createBackendSelfData(false, false),
    contract: {
      contract_id: 10,
      id: 10,
      status: 'active',
      payment_mode: paymentMode,
      current_plan_id: 1,
      current_entitlement_id: 11,
      current_provider_binding_id: 12,
      latest_change_intent_id: 0,
      pending_plan_id: 0,
      pending_effective_at: 0,
      current_period_start: 1000,
      current_period_end: 2000,
      grace_period_end: 0,
      change_version: 1,
    },
  } satisfies SelfSubscriptionDataResponse)
}

describe('normalizeSelfSubscriptionData', () => {
  test('fails closed when canonical self-subscription data is unavailable', () => {
    const normalized = normalizeSelfSubscriptionData(undefined)

    expect(normalized.capabilities).toMatchObject({
      can_change_plan: false,
      can_use_stripe_recurring: false,
      can_use_balance_one_period: false,
      has_migration_conflict: true,
    })
    expect(normalized.migration.requires_admin_review).toBe(true)
    expect(normalized.capabilities.has_migration_conflict).toBe(true)
  })

  test('preserves a safe canonical migration response', () => {
    const normalized = normalizeSelfSubscriptionData(
      createBackendSelfData(false, false)
    )

    expect(normalized.migration.requires_admin_review).toBe(false)
    expect(normalized.capabilities.has_migration_conflict).toBe(false)
  })

  test('keeps canonical admin review false when migration conflict is true', () => {
    const conflict = normalizeSelfSubscriptionData(
      createBackendSelfData(false, true)
    )

    expect(conflict.migration.requires_admin_review).toBe(false)
    expect(conflict.capabilities.has_migration_conflict).toBe(true)
  })

  test('does not retain the legacy migration block flag in normalized wallet state', () => {
    const response = createBackendSelfData(
      false,
      false
    ) as SelfSubscriptionDataResponse & {
      migration: NonNullable<SelfSubscriptionDataResponse['migration']> & {
        blocked: boolean
      }
    }
    response.migration['blocked'] = true

    const normalized = normalizeSelfSubscriptionData(response)

    expect('blocked' in normalized.migration).toBe(false)
  })

  test('preserves canonical self fields used by the wallet lifecycle summary', () => {
    const normalized = normalizeSelfSubscriptionData({
      ...createBackendSelfData(false, false),
      contract: {
        contract_id: 10,
        status: 'active',
        payment_mode: 'stripe_recurring',
        current_plan_id: 1,
        current_entitlement_id: 11,
        current_provider_binding_id: 12,
        latest_change_intent_id: 13,
        pending_plan_id: 2,
        pending_effective_at: 2000,
        change_version: 3,
      },
      current_entitlement: {
        entitlement_id: 11,
        plan_id: 1,
        provider_binding_id: 12,
        status: 'active',
        payment_mode: 'stripe_recurring',
        start_time: 1000,
        end_time: 2000,
        access_end_time: 2100,
      },
      current_period: {
        start: 1000,
        end: 2000,
        grace_period_end: 2100,
      },
      quota: {
        amount_total: 5000,
        amount_used: 1500,
        amount_remaining: 3500,
        unlimited: false,
      },
      pending_change: {
        intent_id: 13,
        kind: 'downgrade',
        status: 'scheduled',
        from_plan_id: 1,
        to_plan_id: 2,
        provider_binding_id: 12,
        effective_at: 2000,
        payment_mode: 'stripe_recurring',
      },
    } as SelfSubscriptionDataResponse)

    expect(normalized.current_entitlement?.entitlement_id).toBe(11)
    expect(normalized.current_period?.end).toBe(2000)
    expect(normalized.quota?.amount_remaining).toBe(3500)
    expect(normalized.pending_change?.to_plan_id).toBe(2)
    expect(normalized.contract?.id).toBe(10)
    expect(normalized.contract?.current_period_end).toBe(2000)
    expect(normalized.contract?.grace_period_end).toBe(2100)
  })

  test('normalizes zero media usage as not included while preserving legacy unlimited windows', () => {
    const normalized = normalizeSelfSubscriptionData({
      ...createBackendSelfData(false, false),
      monthly_bucket: {
        amount_total: 0,
        amount_used: 0,
        amount_remaining: 0,
        unlimited: true,
      },
      window_5h: {
        used: 0,
        total: 0,
        remaining: 0,
        reset_at: 0,
        unlimited: true,
      },
      window_7d: {
        used: 0,
        total: 0,
        remaining: 0,
        reset_at: 0,
        unlimited: true,
      },
      media_credits: {
        used: 0,
        total: 0,
        remaining: 0,
        reset_at: 0,
        unlimited: true,
      },
    } as SelfSubscriptionDataResponse)

    expect(normalized.monthly_bucket?.unlimited).toBe(true)
    expect(normalized.window_5h?.unlimited).toBe(true)
    expect(normalized.window_7d?.unlimited).toBe(true)
    expect(normalized.media_credits?.total).toBe(0)
    expect(normalized.media_credits?.unlimited).toBe(false)
  })
})

describe('getAllowedPaymentModes', () => {
  test('allows Stripe recurring from safe payment modes without a Stripe price id', () => {
    const plan = {
      ...basePlan,
      payment_modes: ['stripe_recurring'],
    } satisfies SubscriptionPlan

    expect(
      getAllowedPaymentModes(plan, stripeTopupInfo, enabledCapabilities)
    ).toEqual(['stripe_recurring'])
  })

  test('disables plan changes when safe payment modes are missing', () => {
    expect(
      getAllowedPaymentModes(basePlan, stripeTopupInfo, enabledCapabilities)
    ).toEqual([])
  })
})

describe('getDisplayedPlanAction', () => {
  const upgradePlan = {
    plan: {
      ...basePlan,
      id: 2,
      payment_modes: ['balance_one_period'],
    },
    relation: 'upgrade',
  } as const

  test('enables a relation-authorized action for a safe canonical response', () => {
    const normalized = normalizeSelfSubscriptionData(
      createBackendSelfData(false, false)
    )

    expect(
      getDisplayedPlanAction(upgradePlan, 1, ['balance_one_period'], normalized)
    ).toBe('upgrade_now')
  })

  test('gates plan actions on canonical admin review and conflict separately', () => {
    const review = normalizeSelfSubscriptionData(
      createBackendSelfData(true, false)
    )
    const conflict = normalizeSelfSubscriptionData(
      createBackendSelfData(false, true)
    )

    expect(
      getDisplayedPlanAction(upgradePlan, 1, ['balance_one_period'], review)
    ).toBe('unavailable')
    expect(
      getDisplayedPlanAction(upgradePlan, 1, ['balance_one_period'], conflict)
    ).toBe('unavailable')
  })

  test('preserves capability-only downgrade behavior without local rank calculations', () => {
    const plan = {
      plan: {
        ...basePlan,
        id: 2,
        price_amount: 1,
        tier_rank: 1,
        payment_modes: ['balance_one_period'],
      },
      relation: 'downgrade',
    }

    expect(
      getDisplayedPlanAction(
        plan,
        1,
        ['balance_one_period'],
        enabledCapabilities
      )
    ).toBe('downgrade_next_period')
  })

  test('fails closed for stale downgrade relations when canonical contract is missing', () => {
    const plan = {
      plan: {
        ...basePlan,
        id: 2,
        payment_modes: ['balance_one_period'],
      },
      relation: 'downgrade',
    }

    expect(
      getDisplayedPlanAction(
        plan,
        1,
        ['balance_one_period'],
        normalizeSelfSubscriptionData(createBackendSelfData(false, false))
      )
    ).toBe('unavailable')
  })

  test('ignores stale downgrade relations for canonical non-recurring contracts', () => {
    const plan = {
      plan: {
        ...basePlan,
        id: 2,
        payment_modes: ['balance_one_period'],
      },
      relation: 'downgrade',
    }

    expect(
      getDisplayedPlanAction(
        plan,
        1,
        ['balance_one_period'],
        createCanonicalLifecycleWithContract('balance_one_period')
      )
    ).toBe('unavailable')
    expect(
      getDisplayedPlanAction(
        plan,
        1,
        ['balance_one_period'],
        createCanonicalLifecycleWithContract('external_one_period')
      )
    ).toBe('unavailable')
  })

  test('preserves next-period downgrades for canonical Stripe recurring contracts', () => {
    const plan = {
      plan: {
        ...basePlan,
        id: 2,
        payment_modes: ['stripe_recurring'],
      },
      relation: 'downgrade',
    }

    expect(
      getDisplayedPlanAction(
        plan,
        1,
        ['stripe_recurring'],
        createCanonicalLifecycleWithContract('stripe_recurring')
      )
    ).toBe('downgrade_next_period')
  })

  test('unknown relation never enables a plan action as a display fallback', () => {
    const plan = {
      plan: {
        ...basePlan,
        id: 2,
        payment_modes: ['balance_one_period'],
      },
    }

    expect(
      getDisplayedPlanAction(
        plan,
        1,
        ['balance_one_period'],
        normalizeSelfSubscriptionData(createBackendSelfData(false, false))
      )
    ).toBe('unavailable')
  })
})

describe('getFlexiblePlanAction', () => {
  test('uses purchase, repurchase, and immediate switch actions without disabling same plan', () => {
    expect(getFlexiblePlanAction({ planId: 1, currentPlanId: 0 })).toBe('buy')
    expect(getFlexiblePlanAction({ planId: 1, currentPlanId: 1 })).toBe(
      'repurchase'
    )
    expect(getFlexiblePlanAction({ planId: 2, currentPlanId: 1 })).toBe(
      'switch'
    )
  })

  test('does not expose next-period downgrade behavior for flexible wallet plan changes', () => {
    expect(
      getFlexiblePlanAction({
        planId: 1,
        currentPlanId: 2,
        relation: 'downgrade',
      })
    ).toBe('switch')
  })
})

describe('buildFlexiblePurchaseRequest', () => {
  test('includes the selected backend quote identifier for checkout consistency', () => {
    expect(
      buildFlexiblePurchaseRequest({
        planId: 2,
        paymentChoice: 'pix',
        months: 3,
        requestId: 'request-1',
        quoteId: 'quote-pix-3',
      })
    ).toEqual({
      plan_id: 2,
      payment_choice: 'pix',
      months: 3,
      request_id: 'request-1',
      quote_id: 'quote-pix-3',
      ui_mode: 'embedded',
    })
  })

  test('requests embedded checkout only for hosted payment choices', () => {
    for (const paymentChoice of [
      'stripe_recurring',
      'alipay',
      'pix',
      'upi',
    ] as const) {
      expect(
        buildFlexiblePurchaseRequest({
          planId: 2,
          paymentChoice,
          months: 3,
          requestId: 'request-embedded',
        }).ui_mode
      ).toBe('embedded')
    }

    expect(
      buildFlexiblePurchaseRequest({
        planId: 2,
        paymentChoice: 'balance',
        months: 3,
        requestId: 'request-balance',
      })
    ).not.toHaveProperty('ui_mode')
  })

  test('forces Stripe recurring to one month while preserving the quote id', () => {
    expect(
      buildFlexiblePurchaseRequest({
        planId: 2,
        paymentChoice: 'stripe_recurring',
        months: 6,
        requestId: 'request-2',
        quoteId: 'quote-stripe',
      }).months
    ).toBe(1)
  })
})
