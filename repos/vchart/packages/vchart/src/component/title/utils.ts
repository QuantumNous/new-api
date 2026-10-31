import type { IPadding } from '../../typings';
import { isNumber } from '@visactor/vutils';

export function transformPadding(padding: number | IPadding) {
  if (isNumber(padding)) {
    return padding;
  }

  const result: number[] = [
    padding.top ? padding.top : 0,
    padding.right ? padding.right : 0,
    padding.bottom ? padding.bottom : 0,
    padding.left ? padding.left : 0
  ];
  return result;
}
