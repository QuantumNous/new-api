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
});
