import { POLAR_END_ANGLE, POLAR_START_ANGLE } from '../../../../constant/polar';
import { calculateMaxRadius, isFunction, isNumber, isValid } from '@visactor/vutils';
import { ComponentTypeEnum } from '../../../interface';
import type { IPolarAxisCommonSpec } from '../interface';
import type { ILayoutRect } from '../../../../typings/layout';
import type { IPoint } from '../../../../typings/coordinate';
import type { IPolarOrientType } from '../../../../typings/space';
import type { AxisType } from '../../interface/common';
import type { ITheme } from '../../../../theme/interface';
import { getComponentThemeFromOption } from '../../../util';
import { mergeSpec } from '@visactor/vutils-extension';

export const getPolarAxisInfo = (spec: IPolarAxisCommonSpec, chartSpec: any) => {
  // TODO: 基于数据处理 axis 类型
  const axisType = spec.type ?? (spec.orient === 'angle' ? 'band' : 'linear');
  const componentName = `${ComponentTypeEnum.polarAxis}-${axisType}`;

  const startAngleFromSpec = spec.startAngle ?? chartSpec.startAngle;
  const endAngleFromSpec = spec.endAngle ?? chartSpec.endAngle;
  return {
    axisType,
    componentName,
    startAngle: startAngleFromSpec ?? POLAR_START_ANGLE,
    endAngle: endAngleFromSpec ?? (isValid(startAngleFromSpec) ? startAngleFromSpec + 360 : POLAR_END_ANGLE),
    center: isValid(chartSpec.center)
      ? chartSpec.center
      : isValid(chartSpec?.centerX) || isValid(chartSpec?.centerY)
      ? {
          x: chartSpec?.centerX,
          y: chartSpec?.centerY
        }
      : undefined,
    // 优先使用 outerRadius, 但要兼容 radius
    outerRadius: spec.outerRadius ?? spec.radius ?? chartSpec.outerRadius ?? chartSpec.radius,
    layoutRadius: chartSpec.layoutRadius
  };
};

export const computeLayoutRadius = (
  getLayoutRadius: () => 'auto' | number | ((layoutRect: ILayoutRect, center: IPoint) => number),
  getLayoutRect: () => ILayoutRect,
  getCenter: () => IPoint,
  getAngles: () => { startAngle: number; endAngle: number }
) => {
  const layoutRadius = getLayoutRadius();
  if (isNumber(layoutRadius)) {
    return layoutRadius;
  } else if (isFunction(layoutRadius)) {
    return layoutRadius(getLayoutRect(), getCenter());
  }

  const rect = getLayoutRect();

  if (layoutRadius === 'auto' && rect.width > 0 && rect.height > 0) {
    const { startAngle = 0, endAngle = 2 * Math.PI } = getAngles();
    return calculateMaxRadius(rect, getCenter(), startAngle, endAngle);
  }

  return Math.min(rect.width / 2, rect.height / 2);
};

export const getPolarAxisTheme = (orient: IPolarOrientType, type: AxisType, getTheme: (...keys: string[]) => any) => {
  const axisTypeTheme =
    (type === 'band'
      ? getComponentThemeFromOption('axisBand', getTheme)
      : type === 'linear'
      ? getComponentThemeFromOption('axisLinear', getTheme)
      : {}) ?? {};
  const axisTheme =
    orient === 'angle'
      ? getComponentThemeFromOption('axisAngle', getTheme)
      : getComponentThemeFromOption('axisRadius', getTheme);
  return mergeSpec({}, getComponentThemeFromOption('axis', getTheme), axisTypeTheme, axisTheme);
};
