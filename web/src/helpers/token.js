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

import { API } from './api';

/**
 * 按需获取单个令牌的真实 key
 * @param {number|string} tokenId
 * @returns {Promise<string>} 返回不带 sk- 前缀的真实 token key
 */
export async function fetchTokenKey(tokenId) {
  const response = await API.post(`/api/token/${tokenId}/key`);
  const { success, data, message } = response.data || {};
  if (!success || !data?.key) {
    throw new Error(message || 'Failed to fetch token key');
  }
  return data.key;
}

/**
 * 批量获取多个令牌的真实 key
 * @param {number[]} tokenIds
 * @returns {Promise<Record<number, string>>} 返回 {id: key} map，key 不带 sk- 前缀
 */
export async function fetchTokenKeysBatch(tokenIds) {
  const response = await API.post('/api/token/batch/keys', { ids: tokenIds });
  const { success, data, message } = response.data || {};
  if (!success || !data?.keys) {
    throw new Error(message || 'Failed to fetch token keys');
  }
  return data.keys;
}

/**
 * 获取可用的 token keys
 * @returns {Promise<string[]>} 返回 active 状态的不带 sk- 前缀的真实 token key 数组
 */
export async function fetchTokenKeys() {
  try {
    const response = await API.get('/api/token/?p=1&size=10');
    const { success, data } = response.data;
    if (!success) throw new Error('Failed to fetch token keys');

    const tokenItems = Array.isArray(data) ? data : data.items || [];
    const activeTokens = tokenItems.filter((token) => token.status === 1);
    const keyResults = await Promise.allSettled(
      activeTokens.map((token) => fetchTokenKey(token.id)),
    );
    return keyResults
      .filter((result) => result.status === 'fulfilled' && result.value)
      .map((result) => result.value);
  } catch (error) {
    console.error('Error fetching token keys:', error);
    return [];
  }
}

/**
 * 获取服务器地址
 * @returns {string} 服务器地址
 */
export function getServerAddress() {
  let status = localStorage.getItem('status');
  let serverAddress = '';

  if (status) {
    try {
      status = JSON.parse(status);
      serverAddress = status.server_address || '';
    } catch (error) {
      console.error('Failed to parse status from localStorage:', error);
    }
  }

  if (!serverAddress) {
    serverAddress = window.location.origin;
  }

  return serverAddress;
}

export const CHANNEL_CONN_CLIPBOARD_TYPE = 'newapi_channel_conn';

/**
 * @param {string} key - 完整的 API key（含 sk- 前缀）
 * @param {string} url - 服务器地址
 * @returns {string} JSON 格式的连接字符串
 */
export function encodeChannelConnectionString(key, url) {
  return JSON.stringify({
    _type: CHANNEL_CONN_CLIPBOARD_TYPE,
    key,
    url,
  });
}

/**
 * @param {string} text - 剪贴板文本
 * @returns {{ key: string, url: string } | null}
 */
export function parseChannelConnectionString(text) {
  if (!text || typeof text !== 'string') return null;
  try {
    const parsed = JSON.parse(text.trim());
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed._type === CHANNEL_CONN_CLIPBOARD_TYPE &&
      typeof parsed.key === 'string' &&
      typeof parsed.url === 'string'
    ) {
      return { key: parsed.key, url: parsed.url };
    }
  } catch {
    // not valid JSON
  }
  return null;
}
