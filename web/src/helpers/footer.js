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
 * 规范化页脚配置值，统一将非字符串输入视为空值。
 * @param {unknown} footer - 原始页脚配置值
 * @returns {string} 去除首尾空白后的页脚内容，或空字符串
 */
export function normalizeFooterValue(footer) {
  return typeof footer === 'string' ? footer.trim() : '';
}

/**
 * 根据页脚内容判断前端应使用的渲染模式。
 * @param {unknown} footer - 原始页脚配置值
 * @returns {'default' | 'iframe' | 'html'} 页脚渲染模式
 */
export function getFooterRenderMode(footer) {
  const normalizedFooter = normalizeFooterValue(footer);

  if (!normalizedFooter) {
    return 'default';
  }

  if (/^https?:\/\//i.test(normalizedFooter)) {
    return 'iframe';
  }

  return 'html';
}
