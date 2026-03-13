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

const STATUS_OPTION_FIELD_MAP = {
  SystemName: 'system_name',
  Logo: 'logo',
  Footer: 'footer_html',
};

/**
 * 将设置项更新转换为需要同步到状态上下文的补丁对象。
 * @param {string} key - 设置项键名
 * @param {unknown} value - 设置项值
 * @returns {{statusKey: string, storageKey: string, value: string} | null} 可同步的状态补丁
 */
export function getStatusOptionPatch(key, value) {
  const statusKey = STATUS_OPTION_FIELD_MAP[key];

  if (!statusKey) {
    return null;
  }

  return {
    statusKey,
    storageKey: statusKey,
    value: typeof value === 'string' ? value : '',
  };
}
