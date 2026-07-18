import { describe, expect, test } from 'bun:test';

import { formatPaymentAmount } from './paymentAmount.js';

describe('formatPaymentAmount', () => {
  test('formats local payment amount as USD when quota display type is USD', () => {
    const result = formatPaymentAmount(70, {
      quotaDisplayType: 'USD',
      status: { usd_exchange_rate: 7 },
      t: (key) => key,
    });

    expect(result).toBe('10.00 USD');
  });

  test('keeps the existing CNY yuan label when quota display type is CNY', () => {
    const result = formatPaymentAmount(70, {
      quotaDisplayType: 'CNY',
      status: { usd_exchange_rate: 7 },
      t: (key) => key,
    });

    expect(result).toBe('70.00 元');
  });
});
