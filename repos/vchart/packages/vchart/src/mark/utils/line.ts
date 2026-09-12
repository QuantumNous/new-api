import { isNil, isString, isArray } from '@visactor/vutils';
import type { IColor, IColorStop } from '@visactor/vrender-core';

export const isStopsEqual = (prev: IColorStop[], next: IColorStop[]) => {
  if (prev === next) {
    return true;
  }
  const prevLength = (prev && prev.length) ?? 0;
  const nextLength = (next && next.length) ?? 0;

  if (prevLength !== nextLength || prevLength === 0) {
    return false;
  }

  return prev.every((prevEntry, prevIndex) => {
    return (
      (!prevEntry && !next[prevIndex]) ||
      (prevEntry &&
        next[prevIndex] &&
        prevEntry.color === next[prevIndex].color &&
        prevEntry.offset === next[prevIndex].offset)
    );
  });
};

const isColorAttrEqual = (prev: IColor, next: IColor): boolean => {
  if (prev === next) {
    return true;
  }

  if (typeof prev !== typeof next) {
    return false;
  }

  if (isString(prev)) {
    return false;
  }

  if (isArray(prev)) {
    if ((prev as any).length !== (next as any).length) {
      return false;
    }

    return (prev as any).every((prevEntry: any, index: number) => isColorAttrEqual(prevEntry, (next as any)[index]));
  }

  if ((prev as any).gradient !== (next as any).gradient) {
    return false;
  }

  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);

  if (prevKeys.length !== nextKeys.length) {
    return false;
  }

  return prevKeys.every(key => {
    if (key === 'stops') {
      return isStopsEqual((prev as any)[key], (next as any)[key]);
    }

    return (prev as any)[key] === (next as any)[key];
  });
};

const isLineDashEqual = (prev: number[], next: number[]) => {
  if (prev.length !== next.length) {
    return false;
  }

  if (prev.join('-') === next.join('-')) {
    return true;
  }

  return false;
};

export const isSegmentAttrEqual = (prev: any, next: any, key: string) => {
  if (isNil(prev) && isNil(next)) {
    return true;
  }

  if (isNil(prev)) {
    return false;
  }

  if (isNil(next)) {
    return false;
  }

  if (key === 'lineDash') {
    return isLineDashEqual(prev, next);
  }

  if (key === 'stroke' || key === 'fill') {
    return isColorAttrEqual(prev, next);
  }

  return prev === next;
};
