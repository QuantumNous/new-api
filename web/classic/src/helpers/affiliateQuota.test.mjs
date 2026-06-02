import { describe, expect, test } from 'bun:test';

import {
  formatAffiliateRawQuota,
  formatAffiliateRmbQuota,
  readAffiliateRmbQuotaConfig,
} from './affiliateQuota.js';

describe('affiliate quota RMB formatting', () => {
  test('formats quota as RMB using quota_per_unit and USD exchange rate', () => {
    expect(
      formatAffiliateRmbQuota(2500, {
        quotaPerUnit: 1000,
        usdExchangeRate: 7,
        digits: 2,
      }),
    ).toBe('¥17.50');
  });

  test('keeps positive tiny values visible', () => {
    expect(
      formatAffiliateRmbQuota(1, {
        quotaPerUnit: 1000000,
        usdExchangeRate: 1,
        digits: 2,
      }),
    ).toBe('¥0.01');
  });

  test('formats raw quota only as an auxiliary value', () => {
    expect(formatAffiliateRawQuota(2500)).toBe('2,500');
  });

  test('reads RMB config from storage without using quota_display_type', () => {
    const storage = {
      getItem(key) {
        if (key === 'quota_per_unit') return '1000';
        if (key === 'status') return '{"usd_exchange_rate":7}';
        if (key === 'quota_display_type') return 'TOKENS';
        return '';
      },
    };

    expect(readAffiliateRmbQuotaConfig(storage)).toEqual({
      quotaPerUnit: 1000,
      usdExchangeRate: 7,
    });
  });
});
