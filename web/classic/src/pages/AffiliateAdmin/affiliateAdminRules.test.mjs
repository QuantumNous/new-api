import { describe, expect, test } from 'bun:test';

import {
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
  formatAffiliateBpsPercent,
  getAffiliateRuleSetStatusMeta,
  isAffiliateRuleSetReadOnly,
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
      auto_settlement_enabled: false,
      review_note: ' finance approval before payout ',
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
          self_brush_strategy: 'exclude',
          bulk_abuse_strategy: 'manual_review',
          action: 'hold_settlement',
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
    expect(values.auto_settlement_enabled).toBe(true);
    expect(values.review_note).toBe('');
    expect(JSON.parse(values.commission_rules_json)).toEqual([
      {
        affiliate_level: 1,
        status: 'active',
        default_cap_rate_bps: 3000,
      },
    ]);
    expect(JSON.parse(values.head_fee_rules_json)).toEqual([
      {
        affiliate_level: 1,
        status: 'active',
        kpi_tier_code: 'base',
      },
    ]);
    expect(JSON.parse(values.risk_rules_json)).toEqual([
      {
        affiliate_level: 1,
        code: 'default',
        self_brush_strategy: 'exclude',
        bulk_abuse_strategy: 'manual_review',
        action: 'manual_review',
      },
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
      auto_settlement_enabled: false,
      review_note: 'monthly finance review',
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
    expect(exported.settlement_config.auto_settlement_enabled).toBe(false);
    expect(exported.settlement_config.review_note).toBe(
      'monthly finance review',
    );
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
    expect(imported.auto_settlement_enabled).toBe(false);
    expect(imported.review_note).toBe('monthly finance review');
    expect(JSON.parse(imported.commission_rules_json)).toEqual([
      { affiliate_level: 1, status: 'active' },
    ]);
    expect(JSON.parse(imported.head_fee_rules_json)).toEqual([
      { kpi_tier_code: 'base', status: 'active' },
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
          auto_settlement_enabled: false,
          review_note: 'copied review note',
        },
        commission_rules: [{ affiliate_level: 1, default_cap_rate_bps: 3000 }],
        head_fee_rules: [{ affiliate_level: 1, kpi_tier_code: 'base' }],
      }),
    });

    expect(copied.id).toBe(0);
    expect(copied.version).toBe('rules-2026-07-copy');
    expect(copied.reason).toBe('');
    expect(copied.auto_settlement_enabled).toBe(false);
    expect(copied.review_note).toBe('copied review note');
    expect(JSON.parse(copied.commission_rules_json)).toEqual([
      {
        affiliate_level: 1,
        status: 'active',
        default_cap_rate_bps: 3000,
      },
    ]);
    expect(JSON.parse(copied.head_fee_rules_json)).toEqual([
      {
        affiliate_level: 1,
        status: 'active',
        kpi_tier_code: 'base',
      },
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
      auto_settlement_enabled: false,
      review_note: 'payout approval',
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
      { section: 'Automatic Settlement', before: 'true', after: 'false' },
      { section: 'Review Note', before: '', after: 'payout approval' },
      { section: 'Commission Tiers', before: 'changed', after: 'changed' },
    ]);
  });

  test('marks published or archived rule sets as read-only and builds status confirmations', () => {
    expect(isAffiliateRuleSetReadOnly({ status: 'draft' })).toBe(false);
    expect(isAffiliateRuleSetReadOnly({ status: 'published' })).toBe(true);
    expect(isAffiliateRuleSetReadOnly({ status: 'archived' })).toBe(true);

    expect(
      buildAffiliateRuleSetStatusConfirmation(t, 'publish', {
        id: 5,
        version: 'rules-2026-08',
        name: 'August Rules',
      }),
    ).toBe(
      '确认发布规则集 rules-2026-08？发布后会启用该版本并归档当前已发布规则。',
    );
    expect(
      buildAffiliateRuleSetStatusConfirmation(t, 'archive', {
        id: 5,
        version: '',
        name: 'August Rules',
      }),
    ).toBe('确认归档规则集 #5？归档后该版本不会再被自动选择。');
  });

  test('builds overwrite confirmation for saving existing draft rule sets', () => {
    expect(
      buildAffiliateRuleSetSaveConfirmation(t, {
        id: 9,
        version: 'rules-2026-09',
        name: 'September Rules',
      }),
    ).toBe('确认覆盖保存规则集 rules-2026-09？保存后会替换现有草稿配置。');
    expect(
      buildAffiliateRuleSetSaveConfirmation(t, { id: 9, version: '' }),
    ).toBe('确认覆盖保存规则集 #9？保存后会替换现有草稿配置。');
  });

  test('builds rollback draft payloads and confirmations', () => {
    expect(
      buildAffiliateRuleSetRollbackPayload(t, {
        id: 5,
        version: 'rules-2026-08',
        name: 'August Rules',
      }),
    ).toEqual({
      version: 'rules-2026-08-rollback',
      name: 'August Rules 回滚草稿',
      reason: '管理员从规则集 rules-2026-08 创建回滚草稿',
    });
    expect(
      buildAffiliateRuleSetRollbackConfirmation(t, {
        id: 5,
        version: 'rules-2026-08',
        name: 'August Rules',
      }),
    ).toBe(
      '确认从规则集 rules-2026-08 创建回滚草稿？该操作会把历史配置复制为新的可编辑草稿。',
    );
  });

  test('provides editable default seed values for new drafts', () => {
    const values = buildAffiliateRuleSetDraftFormValues();
    const commissionTiers = JSON.parse(values.commission_tiers_json);
    const kpiTiers = JSON.parse(values.kpi_tiers_json);
    const headFees = JSON.parse(values.head_fee_rules_json);
    const riskRules = JSON.parse(values.risk_rules_json);

    expect(values.settlement_cycle).toBe('monthly');
    expect(values.manual_review_enabled).toBe(true);
    expect(values.auto_settlement_enabled).toBe(true);
    expect(values.review_note).toBe('');
    expect(riskRules[0].self_brush_strategy).toBe('exclude');
    expect(riskRules[0].bulk_abuse_strategy).toBe('manual_review');
    expect(riskRules[0].action).toBe('manual_review');
    expect(commissionTiers).toHaveLength(10);
    expect(commissionTiers[0].requires_manual_approval).toBe(false);
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
        status: 'active',
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
