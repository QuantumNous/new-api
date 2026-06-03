import { describe, expect, test } from 'bun:test';

import {
  buildAffiliateCommissionAdjustmentPayload,
  buildAffiliateCommissionsQuery,
  buildAffiliateCommissionRecomputePayload,
  buildAffiliateSettlementRunPayload,
  buildAffiliateSettlementsQuery,
  formatAffiliateCentsRMB,
  getAffiliateCommissionKindText,
  getAffiliateEventStatusMeta,
  validateAffiliateCommissionAdjustmentPayload,
  validateAffiliateCommissionRecomputePayload,
  validateAffiliateSettlementRunPayload,
} from './affiliateAdminFinance.js';

const t = (value) => value;

describe('affiliate admin finance helpers', () => {
  test('builds filtered commission and settlement queries', () => {
    expect(
      buildAffiliateCommissionsQuery({
        page: 2,
        pageSize: 20,
        filters: {
          affiliate_user_id: '100',
          downstream_user_id: '300',
          settlement_id: '9',
          status: 'pending',
          kind: 'manual_adjustment',
          period_start: '1000',
          period_end: '2000',
        },
      }),
    ).toBe(
      '/api/affiliate/admin/commissions?p=2&page_size=20&affiliate_user_id=100&downstream_user_id=300&settlement_id=9&status=pending&kind=manual_adjustment&period_start=1000&period_end=2000',
    );

    expect(
      buildAffiliateSettlementsQuery({
        page: 1,
        pageSize: 10,
        filters: {
          affiliate_user_id: '100',
          rule_set_id: '5',
          status: 'draft',
          period_start: '1000',
          period_end: '2000',
        },
      }),
    ).toBe(
      '/api/affiliate/admin/settlements?p=1&page_size=10&affiliate_user_id=100&rule_set_id=5&status=draft&period_start=1000&period_end=2000',
    );
  });

  test('normalizes settlement run and commission recompute payloads', () => {
    const periodStart = Math.floor(Date.parse('2026-06-03T00:00:00Z') / 1000);
    const periodEnd = Math.floor(Date.parse('2026-06-04T00:00:00Z') / 1000);
    expect(
      buildAffiliateSettlementRunPayload({
        rule_set_id: '5',
        period_start: '1000',
        period_end: '2000',
        freeze_days: '7',
        now: '2100',
        quota_per_unit: '1000',
        usd_exchange_rate: '7.2',
        reason: ' close month ',
      }),
    ).toEqual({
      rule_set_id: 5,
      period_start: 1000,
      period_end: 2000,
      freeze_days: 7,
      now: 2100,
      quota_per_unit: 1000,
      usd_exchange_rate: 7.2,
      reason: 'close month',
    });

    expect(
      buildAffiliateSettlementRunPayload({
        period_range: ['2026-06-03T00:00:00Z', '2026-06-04T00:00:00Z'],
        now_datetime: '2026-06-04T01:00:00Z',
      }),
    ).toMatchObject({
      period_start: periodStart,
      period_end: periodEnd,
      now: Math.floor(Date.parse('2026-06-04T01:00:00Z') / 1000),
    });

    expect(
      buildAffiliateCommissionRecomputePayload({
        rule_set_id: '5',
        period_start: '1000',
        period_end: '2000',
        quota_per_unit: '1000',
        usd_exchange_rate: '7',
        reason: ' rerun ',
      }),
    ).toEqual({
      rule_set_id: 5,
      period_start: 1000,
      period_end: 2000,
      quota_per_unit: 1000,
      usd_exchange_rate: 7,
      reason: 'rerun',
    });
  });

  test('normalizes manual commission adjustment payloads', () => {
    expect(
      buildAffiliateCommissionAdjustmentPayload({
        affiliate_user_id: '100',
        downstream_user_id: '300',
        rule_set_id: '5',
        period_start: '1000',
        period_end: '2000',
        commission_cents: '-250',
        reason: ' support clawback ',
      }),
    ).toEqual({
      affiliate_user_id: 100,
      downstream_user_id: 300,
      rule_set_id: 5,
      period_start: 1000,
      period_end: 2000,
      commission_cents: -250,
      reason: 'support clawback',
    });

    expect(
      buildAffiliateCommissionAdjustmentPayload({
        affiliate_user_id: '100',
        commission_yuan: '-2.50',
        reason: ' support clawback ',
      }).commission_cents,
    ).toBe(-250);
  });

  test('validates operation payloads before calling APIs', () => {
    expect(
      validateAffiliateSettlementRunPayload(t, {
        period_start: 2000,
        period_end: 1000,
      }),
    ).toBe('结算周期结束时间不能早于开始时间');

    expect(
      validateAffiliateCommissionRecomputePayload(t, {
        period_start: 1000,
        period_end: 2000,
        reason: '',
      }),
    ).toBe('请填写操作原因');

    expect(
      validateAffiliateCommissionAdjustmentPayload(t, {
        affiliate_user_id: 0,
        commission_cents: 100,
        reason: 'ok',
      }),
    ).toBe('请输入分销商用户 ID');

    expect(
      validateAffiliateCommissionAdjustmentPayload(t, {
        affiliate_user_id: 100,
        commission_cents: 0,
        reason: 'ok',
      }),
    ).toBe('佣金调整金额不能为 0');
  });

  test('maps finance labels and formats RMB cents', () => {
    expect(getAffiliateEventStatusMeta(t, 'pending')).toEqual({
      label: '待处理',
      type: 'warning',
    });
    expect(getAffiliateCommissionKindText(t, 'manual_adjustment')).toBe(
      '人工调整',
    );
    expect(formatAffiliateCentsRMB(12345)).toBe('¥123.45');
    expect(formatAffiliateCentsRMB(-250)).toBe('-¥2.50');
  });
});
