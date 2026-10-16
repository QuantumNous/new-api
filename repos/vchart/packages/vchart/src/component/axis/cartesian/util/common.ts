import type { IOrientType } from '../../../../typings';
// eslint-disable-next-line no-duplicate-imports
import { Direction } from '../../../../typings/space';
import { isValid } from '@visactor/vutils';
import { isValidOrient } from '../../../../util/space';
import type { ICartesianAxisCommonSpec } from '../interface';
import { ComponentTypeEnum } from '../../../interface';
import type { AxisType } from '../../interface/common';
import { getComponentThemeFromOption } from '../../../util';
import { mergeSpec } from '@visactor/vutils-extension';

export function isXAxis(orient: IOrientType) {
  return orient === 'bottom' || orient === 'top';
}

export function isYAxis(orient: IOrientType) {
  return orient === 'left' || orient === 'right';
}

export function isZAxis(orient: IOrientType) {
  return orient === 'z';
}

// 自动推断轴类型，现在根据orient来判断
// TODO：后续可以根据数据特征推断
export function autoAxisType(orient: IOrientType, isHorizontal: boolean) {
  if (isHorizontal) {
    return isXAxis(orient) ? 'linear' : 'band';
  }
  return isXAxis(orient) ? 'band' : 'linear';
}

export function getOrient(spec: ICartesianAxisCommonSpec, whiteList?: string[]): IOrientType {
  return isValidOrient(spec.orient) || (whiteList && whiteList.includes(spec.orient)) ? spec.orient : 'left';
}

export function getDirectionByOrient(orient: IOrientType) {
  return orient === 'top' || orient === 'bottom' ? Direction.horizontal : Direction.vertical;
}

export function isOrientInSameDirection(orient1: IOrientType, orient2: IOrientType) {
  return getDirectionByOrient(orient1) === getDirectionByOrient(orient2);
}

export function transformInverse(spec: ICartesianAxisCommonSpec, isHorizontal: boolean) {
  // 这里处理下 direction === 'horizontal' 下的 Y 轴
  // 因为 Y 轴绘制的时候默认是从下至上绘制的，但是在 direction === 'horizontal' 场景下，图表应该是按照从上至下阅读的
  // 所以这里在这种场景下坐标轴会默认 inverse 已达到效果
  let inverse = spec.inverse;
  if (isHorizontal && !isXAxis(spec.orient)) {
    inverse = isValid(spec.inverse) ? !spec.inverse : true;
  }
  return inverse;
}

export function getCartesianAxisInfo(spec: ICartesianAxisCommonSpec, isHorizontal?: boolean) {
  const axisType = spec.type ?? autoAxisType(spec.orient, isHorizontal);
  const componentName = `${ComponentTypeEnum.cartesianAxis}-${axisType}`;
  return { axisType, componentName };
}

export const getCartesianAxisTheme = (orient: IOrientType, type: AxisType, getTheme: (...keys: string[]) => any) => {
  const axisTypeTheme =
    (type === 'band'
      ? getComponentThemeFromOption('axisBand', getTheme)
      : (['linear', 'log', 'symlog'] as AxisType[]).includes(type)
      ? getComponentThemeFromOption('axisLinear', getTheme)
      : {}) ?? {};
  const axisTheme = isXAxis(orient)
    ? getComponentThemeFromOption('axisX', getTheme)
    : isYAxis(orient)
    ? getComponentThemeFromOption('axisY', getTheme)
    : getComponentThemeFromOption('axisZ', getTheme);
  return mergeSpec({}, getComponentThemeFromOption('axis', getTheme), axisTypeTheme, axisTheme);
};
