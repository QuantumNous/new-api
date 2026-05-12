/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isMobileLikeUserAgent,
  isSafariBrowser,
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

test('shouldUseSameTabPaymentRedirect keeps desktop Safari opening a new tab', () => {
  const ua =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

  assert.equal(isMobileLikeUserAgent(ua), false);
  assert.equal(isSafariBrowser(ua), true);
  assert.equal(shouldUseSameTabPaymentRedirect(ua), false);
});
