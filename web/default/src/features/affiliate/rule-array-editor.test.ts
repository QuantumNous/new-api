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
