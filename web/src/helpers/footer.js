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
 * iframe 页脚在无法测量内容高度时使用的默认回退高度。
 */
export const FOOTER_IFRAME_FALLBACK_HEIGHT = 240;

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

  try {
    const parsedUrl = new URL(normalizedFooter);
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      return 'iframe';
    }
  } catch {
    // Fall through to HTML mode for malformed or non-URL footer content.
  }

  return 'html';
}

/**
 * 判断本次渲染是否需要将 iframe 高度重置为回退值。
 * @param {'default' | 'iframe' | 'html' | null | undefined} previousRenderMode - 上一次渲染模式
 * @param {string | null | undefined} previousFooterValue - 上一次页脚值
 * @param {'default' | 'iframe' | 'html'} nextRenderMode - 当前渲染模式
 * @param {string} nextFooterValue - 当前页脚值
 * @returns {boolean} 是否需要重置 iframe 高度
 */
export function shouldResetFooterIframeHeight(
  previousRenderMode,
  previousFooterValue,
  nextRenderMode,
  nextFooterValue,
) {
  return (
    nextRenderMode === 'iframe' &&
    (previousRenderMode !== nextRenderMode ||
      previousFooterValue !== nextFooterValue)
  );
}
