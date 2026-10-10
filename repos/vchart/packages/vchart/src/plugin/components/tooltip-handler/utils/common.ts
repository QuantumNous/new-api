import { isString, isNumber } from '@visactor/vutils';
import { TOOLTIP_EMPTY_STRING } from '../constants';

/**
 * Escape special HTML characters.
 *
 * @param value A value to convert to string and HTML-escape.
 */
export function escapeHTML(value: any): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\(/g, '&#40;')
    .replace(/  /g, ' &nbsp;'); // 转义符和真空格夹杂，在转义和正常换行之间取得平衡
}

/** 获取元素的绝对缩放因数（支持外部传入 boundingClientRect 提升性能） */
export const getScale = (element: HTMLElement, boundingClientRect?: DOMRect) => {
  if (!element) {
    return 1;
  }
  if (!boundingClientRect) {
    boundingClientRect = element.getBoundingClientRect();
  }
  if (element.offsetWidth > 0) {
    return boundingClientRect.width / element.offsetWidth;
  }
  return element.offsetHeight > 0 ? boundingClientRect.height / element.offsetHeight : 1;
};

export const formatContent = (content: any) => {
  if ((isString(content) && content?.trim() !== '') || isNumber(content)) {
    return escapeHTML(content);
  }

  return TOOLTIP_EMPTY_STRING;
};
