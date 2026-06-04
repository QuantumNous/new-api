import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { __ruleArrayEditorTestUtils } from './rule-array-editor'

describe('affiliate rule table editor helpers', () => {
  test('builds stable table columns and hides grouping fields', () => {
    const columns = __ruleArrayEditorTestUtils.getRuleTableColumns(
      [
        {
          affiliate_level: 1,
          sort_order: 2,
          base_rate_bps: 1333,
        },
        {
          affiliate_level: 1,
          min_net_paid_amount_cents: 20000,
          max_net_paid_amount_cents: 80000,
        },
      ],
      ['affiliate_level']
    )

    assert.deepEqual(columns, [
      'min_net_paid_amount_cents',
      'max_net_paid_amount_cents',
      'base_rate_bps',
      'sort_order',
    ])
  })

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
      ['affiliate_level']
    )

    assert.deepEqual(columns, [
      'name',
      'status',
      'default_rate_bps',
      'min_net_paid_amount_cents',
    ])
    assert.equal(
      __ruleArrayEditorTestUtils.getRuleFieldLabel('status'),
      'Status'
    )
    assert.equal(
      __ruleArrayEditorTestUtils.coerceRuleFieldValue(
        'status',
        'active',
        'disabled'
      ),
      'active'
    )
  })

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
      ['affiliate_level']
    )

    assert.deepEqual(columns, [
      'code',
      'max_gift_only_ratio_bps',
      'self_brush_strategy',
      'bulk_abuse_strategy',
      'action',
    ])
    assert.equal(
      __ruleArrayEditorTestUtils.getRuleFieldLabel('self_brush_strategy'),
      'Self-Brush Strategy'
    )
    assert.equal(
      __ruleArrayEditorTestUtils.getRuleFieldLabel('action'),
      'Processing Action'
    )
    assert.deepEqual(
      __ruleArrayEditorTestUtils
        .getRuleFieldOptions('action')
        .map((option) => option.value),
      ['exclude', 'manual_review', 'hold_settlement']
    )
  })

  test('exposes safe select options for known enum fields', () => {
    assert.deepEqual(
      __ruleArrayEditorTestUtils
        .getRuleFieldOptions('status')
        .map((option) => option.value),
      ['active', 'disabled']
    )
    assert.deepEqual(
      __ruleArrayEditorTestUtils
        .getRuleFieldOptions('kpi_tier_code')
        .map((option) => option.value),
      ['observe', 'base', 'qualified', 'growth', 'excellent']
    )
    assert.deepEqual(
      __ruleArrayEditorTestUtils
        .getRuleFieldOptions('status', 'archived')
        .map((option) => option.value),
      ['active', 'disabled', 'archived']
    )
    assert.deepEqual(__ruleArrayEditorTestUtils.getRuleFieldOptions('code'), [])
  })

  test('builds KPI tier code options from the current KPI tier draft', () => {
    assert.deepEqual(
      __ruleArrayEditorTestUtils.getKPITierCodeOptions(
        [
          { affiliate_level: 1, code: 'starter', name: 'Starter' },
          { affiliate_level: 1, code: 'scale', name: 'Scale' },
          { affiliate_level: 2, code: 'starter', name: 'Second Starter' },
        ],
        1
      ),
      [
        { value: 'starter', label: 'Starter (starter)' },
        { value: 'scale', label: 'Scale (scale)' },
      ]
    )
    assert.deepEqual(
      __ruleArrayEditorTestUtils
        .getRuleFieldOptions('kpi_tier_code', 'custom', {
          kpi_tier_code: [{ value: 'starter', label: 'Starter (starter)' }],
        })
        .map((option) => option.value),
      ['starter', 'custom']
    )
  })

  test('keeps operator-facing yuan and percent units reversible', () => {
    assert.equal(
      __ruleArrayEditorTestUtils.getDisplayValue('base_rate_bps', 1333),
      '13.33'
    )
    assert.equal(
      __ruleArrayEditorTestUtils.getDisplayValue(
        'min_net_paid_amount_cents',
        20000
      ),
      '200.00'
    )
    assert.equal(
      __ruleArrayEditorTestUtils.coerceRuleFieldValue(
        'base_rate_bps',
        '13.33',
        0
      ),
      1333
    )
    assert.equal(
      __ruleArrayEditorTestUtils.coerceRuleFieldValue(
        'min_net_paid_amount_cents',
        '200.00',
        0
      ),
      20000
    )
  })
})
