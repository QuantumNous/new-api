import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isMobileLikeUserAgent,
  shouldUseSameTabPaymentRedirect,
} from './paymentNavigation.js';

test('shouldUseSameTabPaymentRedirect uses same-tab on iPhone Safari', () => {
  const ua =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

  assert.equal(isMobileLikeUserAgent(ua), true);
  assert.equal(shouldUseSameTabPaymentRedirect(ua), true);
});

test('shouldUseSameTabPaymentRedirect uses same-tab on WeChat mobile browser', () => {
  const ua =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.47';

  assert.equal(isMobileLikeUserAgent(ua), true);
  assert.equal(shouldUseSameTabPaymentRedirect(ua), true);
});

test('shouldUseSameTabPaymentRedirect keeps desktop Chrome opening a new tab', () => {
  const ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

  assert.equal(isMobileLikeUserAgent(ua), false);
  assert.equal(shouldUseSameTabPaymentRedirect(ua), false);
});
