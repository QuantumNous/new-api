import test from 'node:test';
import assert from 'node:assert/strict';

import { getPaymentWebhookUrl } from './paymentWebhook.js';

test('builds creem webhook url from server address', () => {
  assert.equal(
    getPaymentWebhookUrl('https://veriai.chat/', 'creem'),
    'https://veriai.chat/api/creem/webhook',
  );
});

test('falls back to placeholder when server address is missing', () => {
  assert.equal(getPaymentWebhookUrl('', 'creem'), '网站地址/api/creem/webhook');
});
