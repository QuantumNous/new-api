import { describe, expect, test } from 'bun:test';

import { buildAffiliateTrendRows } from './affiliateDashboardTrends.js';

describe('classic affiliate dashboard trends', () => {
  test('builds daily trend rows with stable labels and bar widths', () => {
    const rows = buildAffiliateTrendRows({
      daily_trends: [
        {
          period_start: 1780272000,
          period_end: 1780358399,
          effective_new_user_count: 1,
          net_consumption_quota: 1000,
          net_consumption_rmb: 7,
          estimated_commission_rmb: 1.23,
          head_fee_rmb: 2,
          pending_settlement_rmb: 5,
        },
        {
          period_start: 1780358400,
          period_end: 1780444799,
          effective_new_user_count: 2,
          net_consumption_quota: 500,
          net_consumption_rmb: 3.5,
          estimated_commission_rmb: 4.56,
          head_fee_rmb: 3,
          pending_settlement_rmb: 0,
        },
      ],
    });

    expect(rows.map((row) => ({
      label: row.label,
      paidWidth: row.paidWidth,
      pendingWidth: row.pendingWidth,
    }))).toEqual([
      { label: '06-01', paidWidth: 100, pendingWidth: 100 },
      { label: '06-02', paidWidth: 50, pendingWidth: 0 },
    ]);
    expect(rows[1].effectiveNewUsers).toBe(2);
    expect(rows[1].estimatedCommissionRmb).toBe(4.56);
  });

  test('returns an empty list when summary has no trend points', () => {
    expect(buildAffiliateTrendRows(null)).toEqual([]);
    expect(buildAffiliateTrendRows({ daily_trends: [] })).toEqual([]);
  });
});
