import type { IBoundsLike } from '@visactor/vutils';
// eslint-disable-next-line no-duplicate-imports
import { isArray } from '@visactor/vutils';
import { isNumber, isNil, isString, isFunction, couldBeValidNumber, isObject } from './type';
import type { IPadding } from '../typings/space';
import type { IPoint } from '../typings/coordinate';
import type {
  ILayoutNumber,
  ILayoutRect,
  IPercent,
  IPercentOffset,
  ILayoutPaddingSpec,
  ILayoutOrientPadding
} from '../typings/layout';

export function isValidOrient(orient: string): boolean {
  switch (orient) {
    case 'left':
    case 'right':
    case 'top':
    case 'bottom':
      return true;
    default:
      return false;
  }
}

export function isPercent(v: any): v is IPercent {
  if (!isString(v)) {
    return false;
  }
  if (!v.endsWith('%')) {
    return false;
  }
  return couldBeValidNumber(v.substring(0, v.length - 1));
}

export function isPercentOffset(v: any): v is IPercentOffset {
  if (!isObject(v)) {
    return false;
  }
  if ('percent' in v || 'offset' in v) {
    return true;
  }
  return false;
}

export function calcLayoutNumber(
  v: ILayoutNumber | undefined,
  size: number,
  callOp?: ILayoutRect, //如果是函数类型的话，函数的参数
  defaultValue: number = 0
) {
  if (isNumber(v)) {
    return v;
  }
  if (isPercent(v)) {
    return (Number(v.substring(0, v.length - 1)) * size) / 100;
  }
  if (isFunction(v)) {
    return v(callOp);
  }
  if (isObject(v)) {
    return size * (v.percent ?? 0) + (v.offset ?? 0);
  }
  return defaultValue;
}

export function calcPadding(
  paddingSpec: ILayoutOrientPadding,
  rect: ILayoutRect,
  callOp: ILayoutRect //如果是函数类型的话，函数的参数
): IPadding {
  const result: IPadding = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  };
  if (Object.values(paddingSpec).every(value => isNumber(value))) {
    result.top = (<IPadding>paddingSpec).top ?? 0;
    result.right = (<IPadding>paddingSpec).right ?? 0;
    result.bottom = (<IPadding>paddingSpec).bottom ?? 0;
    result.left = (<IPadding>paddingSpec).left ?? 0;
    return result;
  }
  const paddings = [
    {
      orients: ['left', 'right'],
      size: rect.width
    },
    {
      orients: ['top', 'bottom'],
      size: rect.height
    }
  ];
  paddings.forEach(p => {
    p.orients.forEach(o => {
      result[o] = calcLayoutNumber(paddingSpec[o], p.size, callOp);
    });
  });
  return result;
}

export function boundsInRect(bounds: IBoundsLike, rect: ILayoutRect): ILayoutRect {
  if (!bounds) {
    return { width: 0, height: 0 };
  }
  return {
    width: Math.ceil(Math.min(bounds.x2 - bounds.x1, rect.width)),
    height: Math.ceil(Math.min(bounds.y2 - bounds.y1, rect.height))
  };
}

export function normalizeLayoutPaddingSpec(spec: ILayoutPaddingSpec): ILayoutOrientPadding {
  let result: ILayoutOrientPadding = {};
  if (isArray(spec)) {
    if (!isNil(spec[0])) {
      result.top = result.left = result.bottom = result.right = spec[0];
    }
    if (!isNil(spec[1])) {
      result.left = result.right = spec[1];
    }
    if (!isNil(spec[2])) {
      result.bottom = spec[2];
    }
    if (!isNil(spec[3])) {
      result.left = spec[3];
    }
    return result;
  }
  if (isNumber(spec) || isPercent(spec) || isFunction(spec) || isPercentOffset(spec)) {
    result.top = result.left = result.bottom = result.right = spec;
    return result;
  }
  if (isObject(spec)) {
    result = { ...spec };
    return result;
  }
  return result;
}

export function convertPoint(point: IPoint, relativePoint: IPoint, convert: boolean) {
  if (convert) {
    return {
      x: point.x + relativePoint.x,
      y: point.y + relativePoint.y
    };
  }
  return point;
}

/**
 * 将相对数值转换为绝对数值
 * @param originValue 原始值（相对值或绝对值）
 * @param total 总体值
 * @returns 实际绝对数值
 */
export const getActualNumValue = (originValue: number | string, total: number): number => {
  const originNumValue = Number(originValue);
  const originStrValue = originValue.toString();
  if (isNaN(originNumValue) && originStrValue[originStrValue.length - 1] === '%') {
    return total * (Number(originStrValue.slice(0, originStrValue.length - 1)) / 100);
  }
  return originNumValue;
};
