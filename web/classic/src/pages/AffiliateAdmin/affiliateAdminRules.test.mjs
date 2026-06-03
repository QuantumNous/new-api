import { describe, expect, test } from 'bun:test';

import {
  buildAffiliateRuleSetDraftFormValues,
  buildAffiliateRuleSetDraftPayload,
  buildAffiliateRuleSetCopyDraftFormValues,
  buildAffiliateRuleSetDiffPreview,
  buildAffiliateRuleSetExportJson,
  buildAffiliateRuleSetsQuery,
  buildAffiliateRuleSetStatusPayload,
  formatAffiliateBpsPercent,
  getAffiliateRuleSetStatusMeta,
  parseAffiliateRuleSetImportJson,
  validateAffiliateRuleSetDraftPayload,
} from './affiliateAdminRules.js';

const t = (value) => value;

describe('affiliate admin rule set helpers', () => {
  test('builds filtered rule set queries and status payloads', () => {
    expect(
      buildAffiliateRuleSetsQuery({
        page: 2,
        pageSize: 20,
        filters: { status: 'published' },
      }),
    ).toBe('/api/affiliate/admin/rule-sets?p=2&page_size=20&status=published');

    expect(
      buildAffiliateRuleSetsQuery({
        page: 0,
        pageSize: 0,
        filters: { status: 'ignored' },
      }),
    ).toBe('/api/affiliate/admin/rule-sets?p=1&page_size=10');

    expect(buildAffiliateRuleSetStatusPayload({ reason: ' publish ' })).toEqual(
      { reason: 'publish' },
    );
  });

  test('normalizes draft form values into backend payload', () => {
    const payload = buildAffiliateRuleSetDraftPayload({
      id: '9',
      version: ' rules-2026-06 ',
      name: ' Native Affiliate ',
      effective_start: '1000',
      effective_end: '2000',
      reason: ' update rules ',
      settlement_cycle: 'monthly',
      freeze_days: '7',
      min_settlement_amount_cents: '10000',
      manual_review_enabled: true,
      commission_rules_json: JSON.stringify([
        {
          affiliate_level: 1,
          name: 'Level 1',
          default_rate_bps: 1200,
          default_cap_rate_bps: 3000,
          min_settlement_amount_cents: 10000,
          allow_manual_approval_rate: true,
        },
      ]),
      commission_tiers_json: JSON.stringify([
        {
          affiliate_level: 1,
          min_net_paid_amount_cents: 0,
          max_net_paid_amount_cents: 20000,
          base_rate_bps: 2000,
          cap_rate_bps: 3000,
          sort_order: 1,
        },
      ]),
      kpi_tiers_json: JSON.stringify([
        {
          affiliate_level: 1,
          code: 'base',
          name: 'Base',
          coefficient_bps: 10000,
          sort_order: 1,
        },
      ]),
      head_fee_rules_json: JSON.stringify([
        {
          affiliate_level: 1,
          kpi_tier_code: 'base',
          amount_cents: 160,
          qualification_days: 14,
        },
      ]),
      risk_rules_json: JSON.stringify([
        {
          affiliate_level: 1,
          code: 'default',
          max_gift_only_ratio_bps: 2000,
          max_abnormal_ratio_bps: 1000,
        },
      ]),
    });

    expect(payload).toEqual({
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
    });
  });

  test('hydrates draft form values from config snapshot', () => {
    const values = buildAffiliateRuleSetDraftFormValues({
      id: 5,
      version: 'rules-2026-07',
      name: 'July Rules',
      effective_start: 1000,
      effective_end: 2000,
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
    });

    expect(values.id).toBe(5);
    expect(values.version).toBe('rules-2026-07');
    expect(values.settlement_cycle).toBe('monthly');
    expect(values.freeze_days).toBe(7);
    expect(JSON.parse(values.commission_rules_json)).toEqual([
      { affiliate_level: 1, default_cap_rate_bps: 3000 },
    ]);
  });

  test('converts settlement amount yuan fields to backend cents', () => {
    const payload = buildAffiliateRuleSetDraftPayload({
      version: 'rules',
      name: 'Rules',
      settlement_cycle: 'monthly',
      min_settlement_amount_yuan: '88.88',
    });

    expect(payload.settlement_config.min_settlement_amount_cents).toBe(8888);
  });

  test('exports and imports reusable rule set drafts without operation fields', () => {
    const exportJson = buildAffiliateRuleSetExportJson({
      id: 9,
      version: ' rules-2026-08 ',
      name: ' Native Affiliate ',
      reason: ' should not leak ',
      settlement_cycle: 'monthly',
      freeze_days: 7,
      min_settlement_amount_yuan: 88.88,
      manual_review_enabled: true,
      commission_rules_json: JSON.stringify([{ affiliate_level: 1 }]),
      commission_tiers_json: JSON.stringify([{ affiliate_level: 1 }]),
      kpi_tiers_json: JSON.stringify([{ code: 'base' }]),
      head_fee_rules_json: JSON.stringify([{ kpi_tier_code: 'base' }]),
      risk_rules_json: JSON.stringify([{ code: 'default' }]),
    });
    const exported = JSON.parse(exportJson);

    expect(exported.id).toBeUndefined();
    expect(exported.reason).toBeUndefined();
    expect(exported.version).toBe('rules-2026-08');
    expect(exported.settlement_config.min_settlement_amount_cents).toBe(8888);
    expect(exported.commission_rules).toEqual([{ affiliate_level: 1 }]);

    const imported = parseAffiliateRuleSetImportJson(
      JSON.stringify({
        ...exported,
        id: 99,
        reason: 'import should ignore this',
      }),
    );

    expect(imported.id).toBe(0);
    expect(imported.reason).toBe('');
    expect(imported.version).toBe('rules-2026-08');
    expect(imported.min_settlement_amount_yuan).toBe(88.88);
    expect(JSON.parse(imported.commission_rules_json)).toEqual([
      { affiliate_level: 1 },
    ]);
  });

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
        },
        commission_rules: [{ affiliate_level: 1, default_cap_rate_bps: 3000 }],
      }),
    });

    expect(copied.id).toBe(0);
    expect(copied.version).toBe('rules-2026-07-copy');
    expect(copied.reason).toBe('');
    expect(JSON.parse(copied.commission_rules_json)).toEqual([
      { affiliate_level: 1, default_cap_rate_bps: 3000 },
    ]);
  });

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
    });
    const after = {
      ...before,
      version: 'rules-2026-08',
      freeze_days: 14,
      commission_tiers_json: JSON.stringify([
        { affiliate_level: 1, base_rate_bps: 1800 },
      ]),
    };

    expect(buildAffiliateRuleSetDiffPreview(before, after)).toEqual([
      {
        section: 'Version',
        before: 'rules-2026-07',
        after: 'rules-2026-08',
      },
      { section: 'Freeze Days', before: '7', after: '14' },
      { section: 'Commission Tiers', before: 'changed', after: 'changed' },
    ]);
  });

  test('provides editable default seed values for new drafts', () => {
    const values = buildAffiliateRuleSetDraftFormValues();
    const commissionTiers = JSON.parse(values.commission_tiers_json);
    const kpiTiers = JSON.parse(values.kpi_tiers_json);
    const headFees = JSON.parse(values.head_fee_rules_json);

    expect(values.settlement_cycle).toBe('monthly');
    expect(values.manual_review_enabled).toBe(true);
    expect(commissionTiers).toHaveLength(10);
    expect(commissionTiers[0]).toMatchObject({
      affiliate_level: 1,
      min_net_paid_amount_cents: 0,
      max_net_paid_amount_cents: 20000,
      base_rate_bps: 2000,
      cap_rate_bps: 3000,
    });
    expect(commissionTiers[4]).toMatchObject({
      affiliate_level: 1,
      min_net_paid_amount_cents: 500000,
      max_net_paid_amount_cents: 0,
      base_rate_bps: 200,
      cap_rate_bps: 500,
      requires_manual_approval: true,
    });
    expect(kpiTiers).toContainEqual(
      expect.objectContaining({
        affiliate_level: 2,
        code: 'excellent',
        coefficient_bps: 20000,
      }),
    );
    expect(headFees).toContainEqual(
      expect.objectContaining({
        affiliate_level: 1,
        kpi_tier_code: 'qualified',
        amount_cents: 160,
      }),
    );
  });

  test('validates rule set payloads before saving drafts', () => {
    expect(
      validateAffiliateRuleSetDraftPayload(t, {
        version: '',
        name: 'Rules',
        settlement_config: { cycle: 'monthly' },
      }),
    ).toBe('请填写规则集版本');

    expect(
      validateAffiliateRuleSetDraftPayload(t, {
        version: 'rules',
        name: 'Rules',
        effective_start: 2000,
        effective_end: 1000,
        settlement_config: { cycle: 'monthly' },
      }),
    ).toBe('生效结束时间不能早于开始时间');

    expect(
      validateAffiliateRuleSetDraftPayload(t, {
        version: 'rules',
        name: 'Rules',
        settlement_config: { cycle: 'monthly' },
        commission_rules: [{ affiliate_level: 1, default_cap_rate_bps: 4000 }],
      }),
    ).toBe('一级分销 cap 不能超过 30%');

    expect(
      validateAffiliateRuleSetDraftPayload(t, {
        version: 'rules',
        name: 'Rules',
        settlement_config: { cycle: 'monthly' },
        commission_rules: [
          { affiliate_level: 1, default_cap_rate_bps: 2000 },
          { affiliate_level: 2, default_cap_rate_bps: 2500 },
        ],
      }),
    ).toBe('二级分销 cap 不能高于一级');

    expect(
      validateAffiliateRuleSetDraftPayload(t, {
        version: 'rules',
        name: 'Rules',
        settlement_config: { cycle: 'monthly' },
        commission_rules: [{ affiliate_level: 1, default_cap_rate_bps: 2000 }],
        kpi_tiers: [
          { affiliate_level: 1, code: 'base', coefficient_bps: 9000 },
        ],
      }),
    ).toBe('KPI 系数不能低于 1.00');
  });

  test('maps status labels and bps percentages', () => {
    expect(getAffiliateRuleSetStatusMeta(t, 'draft')).toEqual({
      label: '草稿',
      type: 'warning',
    });
    expect(getAffiliateRuleSetStatusMeta(t, 'published')).toEqual({
      label: '已发布',
      type: 'success',
    });
    expect(formatAffiliateBpsPercent(1333)).toBe('13.33%');
  });
});
