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
  SubscriptionRenewalLifecycleResult,
} from '@/features/subscriptions/types'
import type { TopupInfo } from '../types'
import {
  type WalletSelfSubscriptionData,
  applyRenewalLifecycleResultToSelfData,
  buildFlexibleQuoteRequest,
  buildFlexiblePurchaseRequest,
  getMatchingPaymentQuote,
  getFlexiblePlanAction,
  getDisplayedPlanAction,
  getAllowedPaymentModes,
  normalizeSelfSubscriptionData,
  requiresSignedCheckoutQuote,
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

function rawSelfSubscriptionResponse(
  data: unknown
): SelfSubscriptionDataResponse {
  return data as SelfSubscriptionDataResponse
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
  test('normalizes the legacy balance renewal source to absent wallet state', () => {
    const normalized = normalizeSelfSubscriptionData({
      ...createBackendSelfData(false, false),
      renewal_source: 'balance',
      renewal_status: 'enabled',
    })

    expect(normalized.renewal_source).toBeUndefined()
    expect(normalized.renewal_status).toBe('enabled')
  })

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
      monthly_bucket: {
        total: 900,
        used: 225,
        remaining: 675,
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
    expect(normalized.monthly_bucket).toEqual({
      total: 900,
      used: 225,
      remaining: 675,
      unlimited: false,
    })
    expect(normalized.pending_change?.to_plan_id).toBe(2)
    expect(normalized.contract?.id).toBe(10)
    expect(normalized.contract?.current_period_end).toBe(2000)
    expect(normalized.contract?.grace_period_end).toBe(2100)
  })

  test('normalizes monthly and zero media usage without synthesizing short-window buckets', () => {
    const normalized = normalizeSelfSubscriptionData({
      ...createBackendSelfData(false, false),
      monthly_bucket: {
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
    expect('window_5h' in normalized).toBe(false)
    expect('window_7d' in normalized).toBe(false)
    expect(normalized.media_credits?.total).toBe(0)
    expect(normalized.media_credits?.unlimited).toBe(false)
  })

  test('uses an unlimited empty usage window when monthly bucket data is missing', () => {
    const normalized = normalizeSelfSubscriptionData({
      ...createBackendSelfData(false, false),
      quota: {
        amount_total: 5000,
        amount_used: 1500,
        amount_remaining: 3500,
        unlimited: false,
      },
    } as SelfSubscriptionDataResponse)

    expect(normalized.monthly_bucket).toEqual({
      used: 0,
      total: 0,
      remaining: 0,
      reset_at: 0,
      unlimited: true,
    })
  })

  test('preserves canonical provider recurring renewal lifecycle fields', () => {
    const normalized = normalizeSelfSubscriptionData({
      ...createBackendSelfData(false, false),
      renewal_source: 'provider_recurring',
      renewal_status: 'enabled',
      capabilities: {
        can_cancel: true,
        can_resume: false,
        is_cancel_at_period_end: false,
      },
    })

    expect(normalized.renewal_source).toBe('provider_recurring')
    expect(normalized.renewal_status).toBe('enabled')
    expect(normalized.capabilities.can_cancel).toBe(true)
    expect(normalized.capabilities.can_resume).toBe(false)
    expect(normalized.capabilities.is_cancel_at_period_end).toBe(false)
  })

  test('preserves canonical wallet auto renewal cancellation fields', () => {
    const normalized = normalizeSelfSubscriptionData({
      ...createBackendSelfData(false, false),
      renewal_source: 'wallet_auto',
      renewal_status: 'cancelled_by_user',
      capabilities: {
        can_cancel: false,
        can_resume: true,
        is_cancel_at_period_end: true,
      },
    })

    expect(normalized.renewal_source).toBe('wallet_auto')
    expect(normalized.renewal_status).toBe('cancelled_by_user')
    expect(normalized.capabilities.can_cancel).toBe(false)
    expect(normalized.capabilities.can_resume).toBe(true)
    expect(normalized.capabilities.is_cancel_at_period_end).toBe(true)
  })

  test('keeps one-period balance contracts without canonical renewal state empty', () => {
    const normalized =
      createCanonicalLifecycleWithContract('balance_one_period')

    expect(normalized.renewal_source).toBeUndefined()
    expect(normalized.renewal_status).toBeUndefined()
    expect(normalized.capabilities.can_cancel).toBe(false)
    expect(normalized.capabilities.can_resume).toBe(false)
  })

  test('normalizes raw empty and legacy renewal state to absent wallet state', () => {
    const emptyState = normalizeSelfSubscriptionData(
      rawSelfSubscriptionResponse({
        ...createBackendSelfData(false, false),
        renewal_source: '',
        renewal_status: '',
      })
    )
    const legacyState = normalizeSelfSubscriptionData(
      rawSelfSubscriptionResponse({
        ...createBackendSelfData(false, false),
        renewal_source: 'balance',
        renewal_status: 'enabled',
      })
    )
    const unknownState = normalizeSelfSubscriptionData(
      rawSelfSubscriptionResponse({
        ...createBackendSelfData(false, false),
        renewal_source: 'provider_balance',
        renewal_status: 'unknown',
      })
    )

    expect(emptyState.renewal_source).toBeUndefined()
    expect(emptyState.renewal_status).toBeUndefined()
    expect(legacyState.renewal_source).toBeUndefined()
    expect(legacyState.renewal_status).toBe('enabled')
    expect(unknownState.renewal_source).toBeUndefined()
    expect(unknownState.renewal_status).toBeUndefined()
  })
})

describe('applyRenewalLifecycleResultToSelfData', () => {
  function createRenewalLifecycleData(
    source: 'provider_recurring' | 'wallet_auto',
    status: 'enabled' | 'cancelled_by_user'
  ) {
    return normalizeSelfSubscriptionData({
      ...createBackendSelfData(false, false),
      contract: {
        contract_id: 10,
        status: 'active',
        payment_mode:
          source === 'provider_recurring'
            ? 'stripe_recurring'
            : 'balance_one_period',
        current_plan_id: 1,
        current_entitlement_id: 11,
        current_provider_binding_id: source === 'provider_recurring' ? 12 : 0,
        latest_change_intent_id: 0,
        pending_plan_id: 0,
        pending_effective_at: 0,
        current_period_start: 1000,
        current_period_end: 2000,
        grace_period_end: 0,
        change_version: 1,
      },
      current_period: { start: 1000, end: 2000, grace_period_end: 0 },
      remaining_days: 31,
      renewal_source: source,
      renewal_status: status,
      capabilities: {
        can_cancel: status === 'enabled',
        can_resume: status === 'cancelled_by_user',
        is_cancel_at_period_end: status === 'cancelled_by_user',
      },
    })
  }

  function createRenewalLifecycleResult(
    source: 'provider_recurring' | 'wallet_auto',
    status: 'enabled' | 'cancelled_by_user'
  ) {
    return {
      renewal_source: source,
      renewal_status: status,
      current_period_end: 3000,
      change_version: 2,
      can_cancel: status === 'enabled',
      can_resume: status === 'cancelled_by_user',
      is_cancel_at_period_end: status === 'cancelled_by_user',
    } satisfies SubscriptionRenewalLifecycleResult
  }

  test('projects a successful cancel before the canonical refresh completes', () => {
    const current = createRenewalLifecycleData('provider_recurring', 'enabled')
    const result = createRenewalLifecycleResult(
      'provider_recurring',
      'cancelled_by_user'
    )

    const projected = applyRenewalLifecycleResultToSelfData(current, result, 10)

    expect(projected).not.toBe(current)
    expect(projected.renewal_source).toBe('provider_recurring')
    expect(projected.renewal_status).toBe('cancelled_by_user')
    expect(projected.capabilities.can_cancel).toBe(false)
    expect(projected.capabilities.can_resume).toBe(true)
    expect(projected.capabilities.is_cancel_at_period_end).toBe(true)
    expect(projected.contract?.current_period_end).toBe(3000)
    expect(projected.contract?.change_version).toBe(2)
    expect(projected.current_period?.end).toBe(3000)
    expect(projected.remaining_days).toBeUndefined()
    expect(current.renewal_status).toBe('enabled')
  })

  test('does not project a stale result onto a different non-empty renewal source', () => {
    const current = createRenewalLifecycleData('wallet_auto', 'enabled')
    const staleStripeResult = createRenewalLifecycleResult(
      'provider_recurring',
      'cancelled_by_user'
    )

    const projected = applyRenewalLifecycleResultToSelfData(
      current,
      staleStripeResult,
      10
    )

    expect(projected).toBe(current)
    expect(projected.renewal_source).toBe('wallet_auto')
    expect(projected.renewal_status).toBe('enabled')
    expect(projected.capabilities.can_cancel).toBe(true)
    expect(projected.capabilities.can_resume).toBe(false)
    expect(projected.contract?.current_period_end).toBe(2000)
    expect(projected.current_period?.end).toBe(2000)
    expect(projected.remaining_days).toBe(31)
  })

  test('does not project a same-source invalid result period onto a positive canonical period', () => {
    for (const currentPeriodEnd of [0, -1]) {
      const current = createRenewalLifecycleData(
        'provider_recurring',
        'enabled'
      )
      const staleStripeResult = {
        ...createRenewalLifecycleResult(
          'provider_recurring',
          'cancelled_by_user'
        ),
        current_period_end: currentPeriodEnd,
      }

      const projected = applyRenewalLifecycleResultToSelfData(
        current,
        staleStripeResult,
        10
      )

      expect(projected).toBe(current)
      expect(projected.renewal_source).toBe('provider_recurring')
      expect(projected.renewal_status).toBe('enabled')
      expect(projected.capabilities.can_cancel).toBe(true)
      expect(projected.capabilities.can_resume).toBe(false)
      expect(projected.capabilities.is_cancel_at_period_end).toBe(false)
      expect(projected.contract?.current_period_end).toBe(2000)
      expect(projected.current_period?.end).toBe(2000)
      expect(projected.remaining_days).toBe(31)
    }
  })

  test('does not project a same-source stale result onto a later canonical period', () => {
    const base = createRenewalLifecycleData('provider_recurring', 'enabled')
    const current = {
      ...base,
      contract: base.contract
        ? {
            ...base.contract,
            current_period_end: 4000,
          }
        : base.contract,
      current_period: {
        ...base.current_period,
        end: 4000,
      },
    }
    const staleStripeResult = createRenewalLifecycleResult(
      'provider_recurring',
      'cancelled_by_user'
    )

    const projected = applyRenewalLifecycleResultToSelfData(
      current,
      staleStripeResult,
      10
    )

    expect(projected).toBe(current)
    expect(projected.renewal_source).toBe('provider_recurring')
    expect(projected.renewal_status).toBe('enabled')
    expect(projected.capabilities.can_cancel).toBe(true)
    expect(projected.capabilities.can_resume).toBe(false)
    expect(projected.capabilities.is_cancel_at_period_end).toBe(false)
    expect(projected.contract?.current_period_end).toBe(4000)
    expect(projected.current_period?.end).toBe(4000)
    expect(projected.remaining_days).toBe(31)
  })

  test('does not project a same-source older contract version onto canonical data', () => {
    const current = createRenewalLifecycleData('provider_recurring', 'enabled')
    const olderVersionResult = {
      ...createRenewalLifecycleResult(
        'provider_recurring',
        'cancelled_by_user'
      ),
      current_period_end: 3000,
      change_version: 0,
    } satisfies SubscriptionRenewalLifecycleResult

    const projected = applyRenewalLifecycleResultToSelfData(
      current,
      olderVersionResult,
      10
    )

    expect(projected).toBe(current)
    expect(projected.renewal_source).toBe('provider_recurring')
    expect(projected.renewal_status).toBe('enabled')
    expect(projected.capabilities.can_cancel).toBe(true)
    expect(projected.capabilities.can_resume).toBe(false)
    expect(projected.capabilities.is_cancel_at_period_end).toBe(false)
    expect(projected.contract?.change_version).toBe(1)
    expect(projected.contract?.current_period_end).toBe(2000)
    expect(projected.current_period?.end).toBe(2000)
    expect(projected.remaining_days).toBe(31)
  })

  test('does not project a same-source stale result onto a replacement contract', () => {
    const base = createRenewalLifecycleData('provider_recurring', 'enabled')
    const current = {
      ...base,
      contract: base.contract
        ? {
            ...base.contract,
            id: 11,
            contract_id: 11,
          }
        : base.contract,
    }
    const staleStripeResult = createRenewalLifecycleResult(
      'provider_recurring',
      'cancelled_by_user'
    )

    const projected = applyRenewalLifecycleResultToSelfData(
      current,
      staleStripeResult,
      10
    )

    expect(projected).toBe(current)
    expect(projected.contract?.id).toBe(11)
    expect(projected.renewal_source).toBe('provider_recurring')
    expect(projected.renewal_status).toBe('enabled')
    expect(projected.capabilities.can_cancel).toBe(true)
    expect(projected.capabilities.can_resume).toBe(false)
    expect(projected.current_period?.end).toBe(2000)
  })

  test('does not project when the mutation caller lacks a concrete contract target', () => {
    const current = createRenewalLifecycleData('provider_recurring', 'enabled')
    const result = createRenewalLifecycleResult(
      'provider_recurring',
      'cancelled_by_user'
    )

    for (const expectedContractId of [null, 0] as const) {
      const projected = applyRenewalLifecycleResultToSelfData(
        current,
        result,
        expectedContractId
      )

      expect(projected).toBe(current)
      expect(projected.renewal_status).toBe('enabled')
      expect(projected.capabilities.can_cancel).toBe(true)
      expect(projected.capabilities.can_resume).toBe(false)
    }
  })

  test('does not restore a stale renewal result after the canonical source disappears', () => {
    const base = createRenewalLifecycleData('provider_recurring', 'enabled')
    const current = {
      ...base,
      renewal_source: undefined,
      renewal_status: undefined,
      capabilities: {
        ...base.capabilities,
        can_cancel: false,
        can_resume: false,
        is_cancel_at_period_end: false,
      },
    }
    const staleStripeResult = createRenewalLifecycleResult(
      'provider_recurring',
      'cancelled_by_user'
    )

    const projected = applyRenewalLifecycleResultToSelfData(
      current,
      staleStripeResult,
      10
    )

    expect(projected).toBe(current)
    expect(projected.renewal_source).toBeUndefined()
    expect(projected.renewal_status).toBeUndefined()
    expect(projected.capabilities.can_cancel).toBe(false)
    expect(projected.capabilities.can_resume).toBe(false)
    expect(projected.capabilities.is_cancel_at_period_end).toBe(false)
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
          quoteId: `quote-${paymentChoice}-3`,
        }).ui_mode
      ).toBe('embedded')
    }

    expect(
      buildFlexiblePurchaseRequest({
        planId: 2,
        paymentChoice: 'balance',
        months: 3,
        requestId: 'request-balance',
        quoteId: 'quote-balance-3',
      })
    ).not.toHaveProperty('ui_mode')
  })

  test('rejects missing signed quote ids for every payment choice', () => {
    for (const paymentChoice of [
      'stripe_recurring',
      'alipay',
      'pix',
      'upi',
      'balance',
    ] as const) {
      expect(() =>
        buildFlexiblePurchaseRequest({
          planId: 2,
          paymentChoice,
          months: 3,
          requestId: `request-${paymentChoice}`,
        })
      ).toThrow('quote_id is required')
    }
  })

  test('forces Stripe recurring to one month while preserving the quote id', () => {
    const request = buildFlexiblePurchaseRequest({
      planId: 2,
      paymentChoice: 'stripe_recurring',
      months: 6,
      requestId: 'request-2',
      quoteId: 'quote-stripe',
    })

    expect(request.months).toBe(1)
    expect(request.quote_id).toBe('quote-stripe')
  })

  test('requires a future signed Stripe recurring quote before purchase', () => {
    const now = 4_000_000_000
    const validStripeQuote = {
      currency: 'USD',
      months: 1,
      unit_price: 20,
      total: 20,
      quote_id: 'quote-stripe-1',
      expires_at: now + 60,
    }

    expect(requiresSignedCheckoutQuote('stripe_recurring')).toBe(true)
    expect(
      getMatchingPaymentQuote(
        'stripe_recurring',
        { stripe_recurring: validStripeQuote },
        12,
        now
      )?.quote_id
    ).toBe('quote-stripe-1')
    expect(
      getMatchingPaymentQuote(
        'stripe_recurring',
        { stripe_recurring: { ...validStripeQuote, quote_id: '' } },
        1,
        now
      )
    ).toBeUndefined()
    expect(
      getMatchingPaymentQuote(
        'stripe_recurring',
        { stripe_recurring: { ...validStripeQuote, expires_at: now } },
        1,
        now
      )
    ).toBeUndefined()
    expect(
      getMatchingPaymentQuote(
        'stripe_recurring',
        { stripe_recurring: { ...validStripeQuote, months: 2 } },
        1,
        now
      )
    ).toBeUndefined()
  })

  test('normalizes Stripe recurring quote requests to one month', () => {
    expect(
      buildFlexibleQuoteRequest({
        planId: 2,
        paymentChoice: 'stripe_recurring',
        months: 6,
        requestId: 'request-stripe-quote',
      })
    ).toEqual({
      plan_id: 2,
      payment_choice: 'stripe_recurring',
      months: 1,
      request_id: 'request-stripe-quote',
    })
  })

  test('adds recall claim to every flexible purchase request', () => {
    for (const paymentChoice of [
      'stripe_recurring',
      'pix',
      'upi',
      'alipay',
      'balance',
    ] as const) {
      expect(
        buildFlexiblePurchaseRequest({
          planId: 2,
          paymentChoice,
          months: 3,
          requestId: `request-${paymentChoice}-recall`,
          quoteId: `quote-${paymentChoice}-3`,
          recallClaim: 'signed-recall-claim',
        })
      ).toMatchObject({ recall_claim: 'signed-recall-claim' })
    }
  })
})

describe('buildFlexibleQuoteRequest', () => {
  test('adds recall claim to one-time and balance quote requests', () => {
    for (const paymentChoice of ['alipay', 'pix', 'upi', 'balance'] as const) {
      expect(
        buildFlexibleQuoteRequest({
          planId: 2,
          paymentChoice,
          months: 3,
          requestId: `request-${paymentChoice}-quote`,
          recallClaim: 'signed-recall-claim',
        })
      ).toMatchObject({ recall_claim: 'signed-recall-claim' })
    }
  })

  test('requires future signed same-month balance quotes before purchase', () => {
    const now = 4_000_000_000
    const validBalanceQuote = {
      currency: 'USD',
      months: 3,
      unit_price: 100,
      total: 280,
      original_total: 300,
      discount_amount: 20,
      quote_id: 'quote-balance-3',
      expires_at: now + 60,
    }

    expect(requiresSignedCheckoutQuote('balance')).toBe(true)
    expect(
      getMatchingPaymentQuote('balance', { balance: validBalanceQuote }, 3, now)
        ?.quote_id
    ).toBe('quote-balance-3')
    expect(
      getMatchingPaymentQuote(
        'balance',
        { balance: { ...validBalanceQuote, quote_id: '' } },
        3,
        now
      )
    ).toBeUndefined()
    expect(
      getMatchingPaymentQuote(
        'balance',
        { balance: { ...validBalanceQuote, expires_at: now } },
        3,
        now
      )
    ).toBeUndefined()
    expect(
      getMatchingPaymentQuote(
        'balance',
        { balance: { ...validBalanceQuote, months: 2 } },
        3,
        now
      )
    ).toBeUndefined()
  })
})
