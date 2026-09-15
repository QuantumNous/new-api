import type { ParsedArrow } from './arrow-data-transform';

export function isArrowCross(arrow1: ParsedArrow, arrow2: ParsedArrow) {
  const { from: from1, to: to1 } = arrow1;
  const { from: from2, to: to2 } = arrow2;
  return to1 > from2 && to2 > from1;
}

export function isSameArrow(arrow1: ParsedArrow, arrow2: ParsedArrow) {
  const { from: from1, to: to1 } = arrow1;
  const { from: from2, to: to2 } = arrow2;
  return from1 === from2 && to1 === to2;
}
