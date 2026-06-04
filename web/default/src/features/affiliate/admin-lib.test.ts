import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  buildAffiliateCommissionAdjustmentPayload,
  buildAffiliateCommissionRecomputePayload,
  buildAffiliateCommissionsQuery,
  buildAffiliateRuleSetDraftFormValues,
  buildAffiliateRuleSetDraftPayload,
  buildAffiliateRuleSetCopyDraftFormValues,
  buildAffiliateRuleSetDiffPreview,
  buildAffiliateRuleSetExportJson,
  buildAffiliateRuleSetRollbackConfirmation,
  buildAffiliateRuleSetRollbackPayload,
  buildAffiliateRuleSetsQuery,
  buildAffiliateRuleSetSaveConfirmation,
  buildAffiliateRuleSetStatusConfirmation,
  buildAffiliateRuleSetStatusPayload,
  parseAffiliateRuleSetImportJson,
  buildAffiliateSettlementRunPayload,
  buildAffiliateSettlementsQuery,
  buildAffiliateProfilePayload,
  buildAffiliateProfilesQuery,
  formatAffiliateCentsRMB,
  getAffiliateCommissionKindText,
  getAffiliateCommissionStatusMeta,
  getAffiliateRuleSetStatusMeta,
  getAffiliateSettlementStatusMeta,
  getAffiliateProfileLevelLabel,
  getAffiliateProfileStatusMeta,
  isAffiliateRuleSetReadOnly,
  validateAffiliateCommissionAdjustmentPayload,
  validateAffiliateCommissionRecomputePayload,
  validateAffiliateRuleSetDraftPayload,
  validateAffiliateSettlementRunPayload,
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
      'Second-level affiliate requires a parent user ID'
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
      autoSettlementEnabled: false,
      reviewNote: ' finance approval before payout ',
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
          self_brush_strategy: 'exclude',
          bulk_abuse_strategy: 'manual_review',
          action: 'hold_settlement',
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
        auto_settlement_enabled: false,
        review_note: 'finance approval before payout',
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
          requires_manual_approval: false,
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
          self_brush_strategy: 'exclude',
          bulk_abuse_strategy: 'manual_review',
          action: 'hold_settlement',
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
    assert.equal(values.autoSettlementEnabled, true)
    assert.equal(values.reviewNote, '')
    assert.deepEqual(JSON.parse(values.commissionRulesJson || '[]'), [
      {
        affiliate_level: 1,
        status: 'active',
        default_cap_rate_bps: 3000,
      },
    ])
    assert.deepEqual(JSON.parse(values.headFeeRulesJson || '[]'), [
      {
        affiliate_level: 1,
        status: 'active',
        kpi_tier_code: 'base',
      },
    ])
    assert.deepEqual(JSON.parse(values.riskRulesJson || '[]'), [
      {
        affiliate_level: 1,
        code: 'default',
        self_brush_strategy: 'exclude',
        bulk_abuse_strategy: 'manual_review',
        action: 'manual_review',
      },
    ])

    const seed = buildAffiliateRuleSetDraftFormValues()
    const commissionRules = JSON.parse(seed.commissionRulesJson || '[]')
    const commissionTiers = JSON.parse(seed.commissionTiersJson || '[]')
    const headFeeRules = JSON.parse(seed.headFeeRulesJson || '[]')
    const riskRules = JSON.parse(seed.riskRulesJson || '[]')
    assert.equal(seed.settlementCycle, 'monthly')
    assert.equal(seed.manualReviewEnabled, true)
    assert.equal(seed.autoSettlementEnabled, true)
    assert.equal(seed.reviewNote, '')
    assert.equal(commissionRules[0]?.status, 'active')
    assert.equal(commissionRules[1]?.status, 'active')
    assert.equal(headFeeRules[0]?.status, 'active')
    assert.equal(headFeeRules[1]?.status, 'active')
    assert.equal(riskRules[0]?.self_brush_strategy, 'exclude')
    assert.equal(riskRules[0]?.bulk_abuse_strategy, 'manual_review')
    assert.equal(riskRules[0]?.action, 'manual_review')
    assert.equal(commissionTiers.length, 10)
    assert.equal(commissionTiers[0]?.requires_manual_approval, false)
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

  test('converts settlement amount yuan fields to backend cents', () => {
    const payload = buildAffiliateRuleSetDraftPayload({
      version: 'rules',
      name: 'Rules',
      settlementCycle: 'monthly',
      minSettlementAmountYuan: '88.88',
    })

    assert.equal(payload.settlement_config?.min_settlement_amount_cents, 8888)
  })

  test('exports and imports reusable rule set drafts without operation fields', () => {
    const exportJson = buildAffiliateRuleSetExportJson({
      id: '9',
      version: ' rules-2026-08 ',
      name: ' Native Affiliate ',
      reason: ' should not leak ',
      settlementCycle: 'monthly',
      freezeDays: '7',
      minSettlementAmountYuan: '88.88',
      manualReviewEnabled: true,
      autoSettlementEnabled: false,
      reviewNote: 'monthly finance review',
      commissionRulesJson: JSON.stringify([{ affiliate_level: 1 }]),
      commissionTiersJson: JSON.stringify([{ affiliate_level: 1 }]),
      kpiTiersJson: JSON.stringify([{ code: 'base' }]),
      headFeeRulesJson: JSON.stringify([{ kpi_tier_code: 'base' }]),
      riskRulesJson: JSON.stringify([{ code: 'default' }]),
    })
    const exported = JSON.parse(exportJson)

    assert.equal(exported.id, undefined)
    assert.equal(exported.reason, undefined)
    assert.equal(exported.version, 'rules-2026-08')
    assert.equal(exported.settlement_config.min_settlement_amount_cents, 8888)
    assert.equal(exported.settlement_config.auto_settlement_enabled, false)
    assert.equal(
      exported.settlement_config.review_note,
      'monthly finance review'
    )
    assert.deepEqual(exported.commission_rules, [{ affiliate_level: 1 }])

    const imported = parseAffiliateRuleSetImportJson(
      JSON.stringify({
        ...exported,
        id: 99,
        reason: 'import should ignore this',
      })
    )

    assert.equal(imported.id, '')
    assert.equal(imported.reason, '')
    assert.equal(imported.version, 'rules-2026-08')
    assert.equal(imported.minSettlementAmountYuan, '88.88')
    assert.equal(imported.autoSettlementEnabled, false)
    assert.equal(imported.reviewNote, 'monthly finance review')
    assert.deepEqual(JSON.parse(imported.commissionRulesJson || '[]'), [
      { affiliate_level: 1, status: 'active' },
    ])
    assert.deepEqual(JSON.parse(imported.headFeeRulesJson || '[]'), [
      { kpi_tier_code: 'base', status: 'active' },
    ])
  })

  test('copies previous rule sets as a new clean draft', () => {
    const copied = buildAffiliateRuleSetCopyDraftFormValues({
      id: 5,
      version: 'rules-2026-07',
      name: 'July Rules',
      status: 'published',
      effective_start: 1000,
      effective_end: 2000,
      published_at: 1100,
      config_snapshot: JSON.stringify({
        settlement_config: {
          cycle: 'monthly',
          freeze_days: 7,
          min_settlement_amount_cents: 10000,
          manual_review_enabled: true,
          auto_settlement_enabled: false,
          review_note: 'copied review note',
        },
        commission_rules: [{ affiliate_level: 1, default_cap_rate_bps: 3000 }],
        head_fee_rules: [{ affiliate_level: 1, kpi_tier_code: 'base' }],
      }),
    })

    assert.equal(copied.id, '')
    assert.equal(copied.version, 'rules-2026-07-copy')
    assert.equal(copied.reason, '')
    assert.equal(copied.autoSettlementEnabled, false)
    assert.equal(copied.reviewNote, 'copied review note')
    assert.deepEqual(JSON.parse(copied.commissionRulesJson || '[]'), [
      {
        affiliate_level: 1,
        status: 'active',
        default_cap_rate_bps: 3000,
      },
    ])
    assert.deepEqual(JSON.parse(copied.headFeeRulesJson || '[]'), [
      {
        affiliate_level: 1,
        status: 'active',
        kpi_tier_code: 'base',
      },
    ])
  })

  test('builds concise diff previews for changed draft sections only', () => {
    const before = buildAffiliateRuleSetDraftFormValues({
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
        commission_tiers: [{ affiliate_level: 1, base_rate_bps: 2000 }],
      }),
    })
    const after = {
      ...before,
      version: 'rules-2026-08',
      freezeDays: '14',
      autoSettlementEnabled: false,
      reviewNote: 'payout approval',
      commissionTiersJson: JSON.stringify([
        { affiliate_level: 1, base_rate_bps: 1800 },
      ]),
    }

    assert.deepEqual(buildAffiliateRuleSetDiffPreview(before, after), [
      {
        section: 'Version',
        before: 'rules-2026-07',
        after: 'rules-2026-08',
      },
      { section: 'Freeze Days', before: '7', after: '14' },
      { section: 'Automatic Settlement', before: 'true', after: 'false' },
      { section: 'Review Note', before: '', after: 'payout approval' },
      { section: 'Commission Tiers', before: 'changed', after: 'changed' },
    ])
  })

  test('marks published or archived rule sets as read-only and builds status confirmations', () => {
    assert.equal(isAffiliateRuleSetReadOnly({ status: 'draft' }), false)
    assert.equal(isAffiliateRuleSetReadOnly({ status: 'published' }), true)
    assert.equal(isAffiliateRuleSetReadOnly({ status: 'archived' }), true)

    assert.equal(
      buildAffiliateRuleSetStatusConfirmation(
        'publish',
        { id: 5, version: 'rules-2026-08', name: 'August Rules' },
        t
      ),
      'Publish rule set rules-2026-08? This will activate it and archive the current published rule set.'
    )
    assert.equal(
      buildAffiliateRuleSetStatusConfirmation(
        'archive',
        { id: 5, version: '', name: 'August Rules' },
        t
      ),
      'Archive rule set #5? This will stop this version from being selected automatically.'
    )
  })

  test('builds overwrite confirmation for saving existing draft rule sets', () => {
    assert.equal(
      buildAffiliateRuleSetSaveConfirmation(
        { id: 9, version: 'rules-2026-09', name: 'September Rules' },
        t
      ),
      'Overwrite draft rule set rules-2026-09? This will replace the existing draft configuration.'
    )
    assert.equal(
      buildAffiliateRuleSetSaveConfirmation({ id: 9, version: '' }, t),
      'Overwrite draft rule set #9? This will replace the existing draft configuration.'
    )
  })

  test('builds rollback draft payloads and confirmations', () => {
    assert.deepEqual(
      buildAffiliateRuleSetRollbackPayload(
        { id: 5, version: 'rules-2026-08', name: 'August Rules' },
        t
      ),
      {
        version: 'rules-2026-08-rollback',
        name: 'August Rules Rollback',
        reason:
          'Admin created affiliate rule set rollback draft from rules-2026-08',
      }
    )
    assert.equal(
      buildAffiliateRuleSetRollbackConfirmation(
        { id: 5, version: 'rules-2026-08', name: 'August Rules' },
        t
      ),
      'Create rollback draft from rule set rules-2026-08? This will copy the historical configuration into a new editable draft.'
    )
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

describe('default affiliate admin finance helpers', () => {
  test('builds filtered commission and settlement queries', () => {
    assert.equal(
      buildAffiliateCommissionsQuery({
        page: 2,
        pageSize: 20,
        filters: {
          affiliateUserId: '100',
          downstreamUserId: '300',
          settlementId: '9',
          status: 'pending',
          kind: 'manual_adjustment',
          periodStart: '1000',
          periodEnd: '2000',
        },
      }),
      '/api/affiliate/admin/commissions?p=2&page_size=20&affiliate_user_id=100&downstream_user_id=300&settlement_id=9&status=pending&kind=manual_adjustment&period_start=1000&period_end=2000'
    )

    assert.equal(
      buildAffiliateSettlementsQuery({
        page: 1,
        pageSize: 10,
        filters: {
          affiliateUserId: '100',
          ruleSetId: '5',
          status: 'draft',
          periodStart: '1000',
          periodEnd: '2000',
        },
      }),
      '/api/affiliate/admin/settlements?p=1&page_size=10&affiliate_user_id=100&rule_set_id=5&status=draft&period_start=1000&period_end=2000'
    )
  })

  test('normalizes settlement run and commission recompute payloads', () => {
    const periodStart = Math.floor(Date.parse('2026-06-03T00:00:00Z') / 1000)
    const periodEnd = Math.floor(Date.parse('2026-06-04T00:00:00Z') / 1000)
    assert.deepEqual(
      buildAffiliateSettlementRunPayload({
        ruleSetId: '5',
        periodStart: '1000',
        periodEnd: '2000',
        freezeDays: '7',
        now: '2100',
        quotaPerUnit: '1000',
        usdExchangeRate: '7.2',
        reason: ' close month ',
      }),
      {
        rule_set_id: 5,
        period_start: 1000,
        period_end: 2000,
        freeze_days: 7,
        now: 2100,
        quota_per_unit: 1000,
        usd_exchange_rate: 7.2,
        reason: 'close month',
      }
    )

    assert.deepEqual(
      {
        period_start: buildAffiliateSettlementRunPayload({
          periodStart: '2026-06-03T00:00:00Z',
          periodEnd: '2026-06-04T00:00:00Z',
          now: '2026-06-04T01:00:00Z',
        }).period_start,
        period_end: buildAffiliateSettlementRunPayload({
          periodStart: '2026-06-03T00:00:00Z',
          periodEnd: '2026-06-04T00:00:00Z',
          now: '2026-06-04T01:00:00Z',
        }).period_end,
        now: buildAffiliateSettlementRunPayload({
          periodStart: '2026-06-03T00:00:00Z',
          periodEnd: '2026-06-04T00:00:00Z',
          now: '2026-06-04T01:00:00Z',
        }).now,
      },
      {
        period_start: periodStart,
        period_end: periodEnd,
        now: Math.floor(Date.parse('2026-06-04T01:00:00Z') / 1000),
      }
    )

    assert.deepEqual(
      buildAffiliateCommissionRecomputePayload({
        ruleSetId: '5',
        periodStart: '1000',
        periodEnd: '2000',
        quotaPerUnit: '1000',
        usdExchangeRate: '7',
        reason: ' rerun ',
      }),
      {
        rule_set_id: 5,
        period_start: 1000,
        period_end: 2000,
        quota_per_unit: 1000,
        usd_exchange_rate: 7,
        reason: 'rerun',
      }
    )
  })

  test('normalizes manual commission adjustment payloads', () => {
    assert.deepEqual(
      buildAffiliateCommissionAdjustmentPayload({
        affiliateUserId: '100',
        downstreamUserId: '300',
        ruleSetId: '5',
        periodStart: '1000',
        periodEnd: '2000',
        commissionCents: '-250',
        reason: ' support clawback ',
      }),
      {
        affiliate_user_id: 100,
        downstream_user_id: 300,
        rule_set_id: 5,
        period_start: 1000,
        period_end: 2000,
        commission_cents: -250,
        reason: 'support clawback',
      }
    )

    assert.equal(
      buildAffiliateCommissionAdjustmentPayload({
        affiliateUserId: '100',
        commissionYuan: '-2.50',
        reason: ' support clawback ',
      }).commission_cents,
      -250
    )
  })

  test('validates operation payloads before calling APIs', () => {
    assert.equal(
      validateAffiliateSettlementRunPayload(
        {
          period_start: 2000,
          period_end: 1000,
          reason: 'close',
        },
        t
      ),
      'Settlement period end cannot be earlier than start'
    )

    assert.equal(
      validateAffiliateCommissionRecomputePayload(
        {
          period_start: 1000,
          period_end: 2000,
          reason: '',
        },
        t
      ),
      'Operation reason is required'
    )

    assert.equal(
      validateAffiliateCommissionAdjustmentPayload(
        {
          affiliate_user_id: 0,
          commission_cents: 100,
          reason: 'ok',
        },
        t
      ),
      'Affiliate user ID is required'
    )

    assert.equal(
      validateAffiliateCommissionAdjustmentPayload(
        {
          affiliate_user_id: 100,
          commission_cents: 0,
          reason: 'ok',
        },
        t
      ),
      'Commission adjustment amount cannot be zero'
    )
  })

  test('maps finance labels and formats RMB cents', () => {
    assert.deepEqual(getAffiliateCommissionStatusMeta('pending', t), {
      label: 'Pending',
      variant: 'warning',
    })
    assert.deepEqual(getAffiliateSettlementStatusMeta('paid', t), {
      label: 'Paid',
      variant: 'success',
    })
    assert.equal(
      getAffiliateCommissionKindText('manual_adjustment', t),
      'Manual adjustment'
    )
    assert.equal(formatAffiliateCentsRMB(12345), '¥123.45')
    assert.equal(formatAffiliateCentsRMB(-250), '-¥2.50')
  })
})
