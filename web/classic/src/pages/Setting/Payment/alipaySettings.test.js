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
  buildAlipayPendingOrdersWarning,
  buildClearAlipayKeyWarning,
  shouldWarnBeforeClearingAlipayKey,
} from './alipaySettings.js';

test('buildAlipayPendingOrdersWarning explains historical order handling', () => {
  assert.equal(
    buildAlipayPendingOrdersWarning(3),
    '当前仍有 3 笔支付宝待处理订单。关闭支付宝只会阻止新订单，历史订单仍依赖当前配置处理回调和补单。',
  );
});

test('shouldWarnBeforeClearingAlipayKey returns true only when pending orders exist', () => {
  assert.equal(shouldWarnBeforeClearingAlipayKey(0), false);
  assert.equal(shouldWarnBeforeClearingAlipayKey(2), true);
});

test('buildClearAlipayKeyWarning uses stronger copy when pending orders exist', () => {
  assert.equal(
    buildClearAlipayKeyWarning('应用私钥', 2),
    '当前仍有 2 笔支付宝待处理订单。清空应用私钥会影响这些历史订单的回调验签和补单，请确认后再继续。',
  );
  assert.equal(
    buildClearAlipayKeyWarning('应用私钥', 0),
    '确认清空应用私钥？',
  );
});
