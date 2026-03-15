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

/**
 * 构建支付渠道的 webhook 回调地址。
 * @param {string | null | undefined} serverAddress - 后台配置的站点地址
 * @param {string} provider - 支付渠道标识
 * @param {string} [fallbackBaseLabel=''] - 站点地址缺失时使用的展示占位
 * @returns {string} 标准化后的 webhook 地址
 */
export function getPaymentWebhookUrl(
  serverAddress,
  provider,
  fallbackBaseLabel = '',
) {
  const normalizedServerAddress = String(serverAddress || '')
    .trim()
    .replace(/\/+$/, '');
  const normalizedFallbackBaseLabel = String(fallbackBaseLabel || '')
    .trim()
    .replace(/\/+$/, '');
  const baseUrl = normalizedServerAddress || normalizedFallbackBaseLabel;
  return `${baseUrl}/api/${provider}/webhook`;
}
