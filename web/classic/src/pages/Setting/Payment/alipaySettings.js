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

export function buildClearAlipayEncryptKeyOption() {
  return {
    key: 'AlipayEncryptKey',
    value: '',
  };
}

export function buildClearAlipayOption(key) {
  return {
    key,
    value: '',
  };
}

export function buildAlipayPendingOrdersWarning(count) {
  return `当前仍有 ${count} 笔支付宝待处理订单。关闭支付宝只会阻止新订单，历史订单仍依赖当前配置处理回调和补单。`;
}

export function shouldWarnBeforeClearingAlipayKey(count) {
  return Number(count) > 0;
}

export function buildClearAlipayKeyWarning(label, count) {
  if (shouldWarnBeforeClearingAlipayKey(count)) {
    return `当前仍有 ${count} 笔支付宝待处理订单。清空${label}会影响这些历史订单的回调验签和补单，请确认后再继续。`;
  }
  return `确认清空${label}？`;
}
