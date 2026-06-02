import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  buildAffiliateRuleSetDraftFormValues,
  buildAffiliateRuleSetDraftPayload,
  buildAffiliateRuleSetsQuery,
  buildAffiliateRuleSetStatusPayload,
  buildAffiliateProfilePayload,
  buildAffiliateProfilesQuery,
  getAffiliateRuleSetStatusMeta,
  getAffiliateProfileLevelLabel,
  getAffiliateProfileStatusMeta,
  validateAffiliateRuleSetDraftPayload,
  validateAffiliateProfilePayload,
} from './admin-lib'

const t = (key: string) => key

describe('default affiliate admin profiles helpers', () => {
  test('builds a filtered admin profiles query', () => {
    assert.equal(
      buildAffiliateProfilesQuery({
        page: 2,
        pageSize: 20,
        filters: { userId: '501', level: '2', status: 'active' },
      }),
      '/api/affiliate/admin/profiles?p=2&page_size=20&user_id=501&level=2&status=active'
    )
  })

  test('normalizes level one and level two profile payloads', () => {
    assert.deepEqual(
      buildAffiliateProfilePayload({
        userId: '501',
        level: '1',
        parentUserId: '999',
        inviteCode: ' aff501 ',
        reason: ' create ',
      }),
      {
        user_id: 501,
        level: 1,
        parent_user_id: 0,
        invite_code: 'aff501',
        reason: 'create',
      }
    )

    assert.deepEqual(
      buildAffiliateProfilePayload({
        userId: '502',
        level: '2',
        parentUserId: '501',
      }),
      {
        user_id: 502,
        level: 2,
        parent_user_id: 501,
        invite_code: '',
        reason: '',
      }
    )
  })

  test('validates second level parent requirements', () => {
    assert.equal(
      validateAffiliateProfilePayload(
        {
          user_id: 502,
          level: 2,
          parent_user_id: 0,
          invite_code: '',
          reason: '',
        },
        t
      ),
      'Second-level affiliate requires a level-one parent user ID'
    )

    assert.equal(
      validateAffiliateProfilePayload(
        {
          user_id: 502,
          level: 2,
          parent_user_id: 502,
          invite_code: '',
          reason: '',
        },
        t
      ),
      'Second-level affiliate parent cannot be itself'
    )
  })

  test('maps level and status labels', () => {
    assert.equal(getAffiliateProfileLevelLabel(1, t), 'Level-one affiliate')
    assert.equal(getAffiliateProfileLevelLabel(2, t), 'Level-two affiliate')
    assert.deepEqual(getAffiliateProfileStatusMeta('active', t), {
      label: 'Active',
      variant: 'success',
    })
    assert.deepEqual(getAffiliateProfileStatusMeta('disabled', t), {
      label: 'Disabled',
      variant: 'danger',
    })
  })
})

describe('default affiliate admin rule set helpers', () => {
  test('builds filtered rule set queries and status payloads', () => {
    assert.equal(
      buildAffiliateRuleSetsQuery({
        page: 2,
        pageSize: 20,
        filters: { status: 'published' },
      }),
      '/api/affiliate/admin/rule-sets?p=2&page_size=20&status=published'
    )
    assert.equal(
      buildAffiliateRuleSetsQuery({
        page: 0,
        pageSize: 0,
        filters: { status: 'ignored' },
      }),
      '/api/affiliate/admin/rule-sets?p=1&page_size=10'
    )
    assert.deepEqual(buildAffiliateRuleSetStatusPayload(' publish '), {
      reason: 'publish',
    })
  })

  test('normalizes draft form values into backend rule set payloads', () => {
    const payload = buildAffiliateRuleSetDraftPayload({
      id: '9',
      version: ' rules-2026-06 ',
      name: ' Native Affiliate ',
      effectiveStart: '1000',
      effectiveEnd: '2000',
      reason: ' update rules ',
      settlementCycle: 'monthly',
      freezeDays: '7',
      minSettlementAmountCents: '10000',
      manualReviewEnabled: true,
      commissionRulesJson: JSON.stringify([
        {
          affiliate_level: 1,
          name: 'Level 1',
          default_rate_bps: 1200,
          default_cap_rate_bps: 3000,
          min_settlement_amount_cents: 10000,
          allow_manual_approval_rate: true,
        },
      ]),
      commissionTiersJson: JSON.stringify([
        {
          affiliate_level: 1,
          min_net_paid_amount_cents: 0,
          max_net_paid_amount_cents: 20000,
          base_rate_bps: 2000,
          cap_rate_bps: 3000,
          sort_order: 1,
        },
      ]),
      kpiTiersJson: JSON.stringify([
        {
          affiliate_level: 1,
          code: 'base',
          name: 'Base',
          coefficient_bps: 10000,
          sort_order: 1,
        },
      ]),
      headFeeRulesJson: JSON.stringify([
        {
          affiliate_level: 1,
          kpi_tier_code: 'base',
          amount_cents: 160,
          qualification_days: 14,
        },
      ]),
      riskRulesJson: JSON.stringify([
        {
          affiliate_level: 1,
          code: 'default',
          max_gift_only_ratio_bps: 2000,
          max_abnormal_ratio_bps: 1000,
        },
      ]),
    })

    assert.deepEqual(payload, {
      id: 9,
      version: 'rules-2026-06',
      name: 'Native Affiliate',
      effective_start: 1000,
      effective_end: 2000,
      reason: 'update rules',
      settlement_config: {
        cycle: 'monthly',
        freeze_days: 7,
        min_settlement_amount_cents: 10000,
        manual_review_enabled: true,
      },
      commission_rules: [
        {
          affiliate_level: 1,
          name: 'Level 1',
          default_rate_bps: 1200,
          default_cap_rate_bps: 3000,
          min_settlement_amount_cents: 10000,
          allow_manual_approval_rate: true,
        },
      ],
      commission_tiers: [
        {
          affiliate_level: 1,
          min_net_paid_amount_cents: 0,
          max_net_paid_amount_cents: 20000,
          base_rate_bps: 2000,
          cap_rate_bps: 3000,
          sort_order: 1,
        },
      ],
      kpi_tiers: [
        {
          affiliate_level: 1,
          code: 'base',
          name: 'Base',
          coefficient_bps: 10000,
          sort_order: 1,
        },
      ],
      head_fee_rules: [
        {
          affiliate_level: 1,
          kpi_tier_code: 'base',
          amount_cents: 160,
          qualification_days: 14,
        },
      ],
      risk_rules: [
        {
          affiliate_level: 1,
          code: 'default',
          max_gift_only_ratio_bps: 2000,
          max_abnormal_ratio_bps: 1000,
        },
      ],
    })
  })

  test('hydrates rule set forms from snapshots and provides default seed values', () => {
    const values = buildAffiliateRuleSetDraftFormValues({
      id: 5,
      version: 'rules-2026-07',
      name: 'July Rules',
      status: 'draft',
      effective_start: 1000,
      effective_end: 2000,
      published_at: 0,
      config_snapshot: JSON.stringify({
        settlement_config: {
          cycle: 'monthly',
          freeze_days: 7,
          min_settlement_amount_cents: 10000,
          manual_review_enabled: true,
        },
        commission_rules: [{ affiliate_level: 1, default_cap_rate_bps: 3000 }],
        commission_tiers: [{ affiliate_level: 1, cap_rate_bps: 3000 }],
        kpi_tiers: [{ affiliate_level: 1, code: 'base' }],
        head_fee_rules: [{ affiliate_level: 1, kpi_tier_code: 'base' }],
        risk_rules: [{ affiliate_level: 1, code: 'default' }],
      }),
    })

    assert.equal(values.id, '5')
    assert.equal(values.version, 'rules-2026-07')
    assert.equal(values.settlementCycle, 'monthly')
    assert.deepEqual(JSON.parse(values.commissionRulesJson), [
      { affiliate_level: 1, default_cap_rate_bps: 3000 },
    ])

    const seed = buildAffiliateRuleSetDraftFormValues()
    const commissionTiers = JSON.parse(seed.commissionTiersJson)
    assert.equal(seed.settlementCycle, 'monthly')
    assert.equal(seed.manualReviewEnabled, true)
    assert.equal(commissionTiers.length, 10)
    assert.deepEqual(commissionTiers[4], {
      affiliate_level: 1,
      min_net_paid_amount_cents: 500000,
      max_net_paid_amount_cents: 0,
      base_rate_bps: 200,
      cap_rate_bps: 500,
      requires_manual_approval: true,
      sort_order: 5,
    })
  })

  test('validates rule set payloads before saving drafts', () => {
    assert.equal(
      validateAffiliateRuleSetDraftPayload(
        {
          version: '',
          name: 'Rules',
          settlement_config: { cycle: 'monthly' },
        },
        t
      ),
      'Rule set version is required'
    )
    assert.equal(
      validateAffiliateRuleSetDraftPayload(
        {
          version: 'rules',
          name: 'Rules',
          effective_start: 2000,
          effective_end: 1000,
          settlement_config: { cycle: 'monthly' },
        },
        t
      ),
      'Effective end cannot be earlier than effective start'
    )
    assert.equal(
      validateAffiliateRuleSetDraftPayload(
        {
          version: 'rules',
          name: 'Rules',
          settlement_config: { cycle: 'monthly' },
          commission_rules: [
            { affiliate_level: 1, default_cap_rate_bps: 4000 },
          ],
        },
        t
      ),
      'Level-one affiliate cap cannot exceed 30%'
    )
    assert.equal(
      validateAffiliateRuleSetDraftPayload(
        {
          version: 'rules',
          name: 'Rules',
          settlement_config: { cycle: 'monthly' },
          kpi_tiers: [
            { affiliate_level: 1, code: 'base', coefficient_bps: 9000 },
          ],
        },
        t
      ),
      'KPI coefficient cannot be below 1.00'
    )
  })

  test('maps rule set status labels', () => {
    assert.deepEqual(getAffiliateRuleSetStatusMeta('draft', t), {
      label: 'Draft',
      variant: 'warning',
    })
    assert.deepEqual(getAffiliateRuleSetStatusMeta('published', t), {
      label: 'Published',
      variant: 'success',
    })
  })
})
