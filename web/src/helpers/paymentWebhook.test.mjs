import test from 'node:test';
import assert from 'node:assert/strict';

import { getPaymentWebhookUrl } from './paymentWebhook.js';

test('builds creem webhook url from server address', () => {
  assert.equal(
    getPaymentWebhookUrl('https://veriai.chat/', 'creem'),
    'https://veriai.chat/api/creem/webhook',
  );
});

test('uses caller-provided fallback when server address is missing', () => {
  assert.equal(
    getPaymentWebhookUrl('', 'creem', 'Website Address'),
    'Website Address/api/creem/webhook',
  );
});

test('normalizes fallback labels with trailing slashes', () => {
  assert.equal(
    getPaymentWebhookUrl('', 'creem', 'https://veriai.chat/'),
    'https://veriai.chat/api/creem/webhook',
  );
});

test('returns a relative webhook path when no fallback is provided', () => {
  assert.equal(getPaymentWebhookUrl('', 'creem'), '/api/creem/webhook');
});
