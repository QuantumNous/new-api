import { describe, expect, test } from 'bun:test';
import { __ruleArrayEditorTestUtils } from './RuleArrayEditor.jsx';

describe('classic affiliate rule table editor helpers', () => {
  test('keeps commission rule status as an operator-facing column', () => {
    const columns = __ruleArrayEditorTestUtils.getRuleTableColumns(
      [
        {
          affiliate_level: 1,
          name: 'Level 1',
          status: 'disabled',
          default_rate_bps: 2000,
          min_net_paid_amount_cents: 0,
        },
      ],
      ['affiliate_level'],
    );

    expect(columns).toEqual([
      'name',
      'status',
      'default_rate_bps',
      'min_net_paid_amount_cents',
    ]);
    expect(__ruleArrayEditorTestUtils.getRuleFieldLabel('status')).toBe(
      'Status',
    );
    expect(
      __ruleArrayEditorTestUtils.coerceRuleFieldValue(
        'status',
        'active',
        'disabled',
      ),
    ).toBe('active');
  });

  test('keeps risk policy strategies and action as operator-facing columns', () => {
    const columns = __ruleArrayEditorTestUtils.getRuleTableColumns(
      [
        {
          affiliate_level: 1,
          code: 'default',
          max_gift_only_ratio_bps: 2000,
          self_brush_strategy: 'exclude',
          bulk_abuse_strategy: 'manual_review',
          action: 'hold_settlement',
        },
      ],
      ['affiliate_level'],
    );

    expect(columns).toEqual([
      'code',
      'max_gift_only_ratio_bps',
      'self_brush_strategy',
      'bulk_abuse_strategy',
      'action',
    ]);
    expect(
      __ruleArrayEditorTestUtils.getRuleFieldLabel('bulk_abuse_strategy'),
    ).toBe('Bulk-Abuse Strategy');
    expect(__ruleArrayEditorTestUtils.getRuleFieldLabel('action')).toBe(
      'Processing Action',
    );
    expect(
      __ruleArrayEditorTestUtils
        .getRuleFieldOptions('action')
        .map((option) => option.value),
    ).toEqual(['exclude', 'manual_review', 'hold_settlement']);
  });

  test('exposes safe select options for known enum fields', () => {
    expect(
      __ruleArrayEditorTestUtils
        .getRuleFieldOptions('status')
        .map((option) => option.value),
    ).toEqual(['active', 'disabled']);
    expect(
      __ruleArrayEditorTestUtils
        .getRuleFieldOptions('kpi_tier_code')
        .map((option) => option.value),
    ).toEqual(['observe', 'base', 'qualified', 'growth', 'excellent']);
    expect(
      __ruleArrayEditorTestUtils
        .getRuleFieldOptions('status', 'archived')
        .map((option) => option.value),
    ).toEqual(['active', 'disabled', 'archived']);
    expect(__ruleArrayEditorTestUtils.getRuleFieldOptions('code')).toEqual([]);
  });

  test('builds KPI tier code options from the current KPI tier draft', () => {
    expect(
      __ruleArrayEditorTestUtils.getKPITierCodeOptions(
        [
          { affiliate_level: 1, code: 'starter', name: 'Starter' },
          { affiliate_level: 1, code: 'scale', name: 'Scale' },
          { affiliate_level: 2, code: 'starter', name: 'Second Starter' },
        ],
        1,
      ),
    ).toEqual([
      { value: 'starter', label: 'Starter (starter)' },
      { value: 'scale', label: 'Scale (scale)' },
    ]);
    expect(
      __ruleArrayEditorTestUtils
        .getRuleFieldOptions('kpi_tier_code', 'custom', {
          kpi_tier_code: [{ value: 'starter', label: 'Starter (starter)' }],
        })
        .map((option) => option.value),
    ).toEqual(['starter', 'custom']);
  });
});
