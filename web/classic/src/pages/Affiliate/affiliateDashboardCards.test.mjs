import { describe, expect, test } from 'bun:test';

import { buildAffiliateDashboardCards } from './affiliateDashboardCards.js';

const t = (value) => value;

describe('affiliate dashboard cards', () => {
  test('builds the Phase 7 dashboard cards with RMB as the primary money display', () => {
    const cards = buildAffiliateDashboardCards(t, {
      team_user_count: 12,
      effective_new_user_count: 5,
      net_consumption_quota: 2500,
      net_consumption_rmb: 17.5,
      estimated_commission_rmb: 3.25,
      head_fee_rmb: 10,
      pending_settlement_rmb: 13.25,
      kpi_tier_name: 'S1',
      rule_status: 'active',
    });

    expect(cards.map((card) => card.key)).toEqual([
      'team_user_count',
      'effective_new_user_count',
      'net_consumption',
      'estimated_commission',
      'head_fee',
      'pending_settlement',
      'kpi_tier',
    ]);
    expect(cards[2].value).toBe('¥17.50');
    expect(cards[2].description).toBe('原始额度 2,500');
    expect(cards[3].value).toBe('¥3.25');
    expect(cards[6].value).toBe('S1');
  });

  test('uses safe pending placeholders before commission and KPI rules land', () => {
    const cards = buildAffiliateDashboardCards(t, {
      team_user_count: 0,
      effective_new_user_count: 0,
      net_consumption_quota: 0,
      net_consumption_rmb: 0,
      estimated_commission_rmb: 0,
      head_fee_rmb: 0,
      pending_settlement_rmb: 0,
      kpi_tier_name: '待配置',
      rule_status: 'pending_rules',
    });

    expect(cards[3].description).toBe('规则未发布，暂按 ¥0.00 展示');
    expect(cards[4].description).toBe('人头费规则未发布');
    expect(cards[6].description).toBe('等待管理员发布分销规则');
  });

  test('uses default card values when summary failed to load', () => {
    const cards = buildAffiliateDashboardCards(t, null);

    expect(cards[0].value).toBe('0');
    expect(cards[2].value).toBe('¥0.00');
    expect(cards[3].value).toBe('¥0.00');
    expect(cards[6].value).toBe('待配置');
  });
});
