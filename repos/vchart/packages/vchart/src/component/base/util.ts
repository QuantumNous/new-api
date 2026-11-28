import type { ITheme } from '../../theme';
import { Direction, type IOrientType } from '../../typings';
import { getCartesianAxisTheme, getDirectionByOrient, getOrient } from '../axis/cartesian/util/common';
import { getPolarAxisTheme } from '../axis/polar/util/common';
import { getCartesianCrosshairTheme, getPolarCrosshairTheme } from '../crosshair/utils';
import type { ComponentThemeWithDirection } from '../interface';
import { ComponentTypeEnum } from '../interface/type';
import { getComponentThemeFromOption } from '../util';
import { mergeSpec } from '@visactor/vutils-extension';

export function getComponentThemeFromGlobalTheme(
  type: ComponentTypeEnum,
  getTheme: (...key: string[]) => any,
  componentSpec: any,
  chartSpec: any
) {
  switch (type) {
    case ComponentTypeEnum.cartesianBandAxis:
      return getCartesianAxisTheme(getOrient(componentSpec, ['z']), 'band', getTheme);
    case ComponentTypeEnum.cartesianLinearAxis:
      return getCartesianAxisTheme(getOrient(componentSpec, ['z']), 'linear', getTheme);
    case ComponentTypeEnum.cartesianLogAxis:
      return getCartesianAxisTheme(getOrient(componentSpec, ['z']), 'log', getTheme);
    case ComponentTypeEnum.cartesianSymlogAxis:
      return getCartesianAxisTheme(getOrient(componentSpec, ['z']), 'symlog', getTheme);
    case ComponentTypeEnum.cartesianAxis:
    case ComponentTypeEnum.cartesianTimeAxis:
      return getCartesianAxisTheme(getOrient(componentSpec), undefined, getTheme);
    case ComponentTypeEnum.polarBandAxis:
      return getPolarAxisTheme(componentSpec.orient, 'band', getTheme);
    case ComponentTypeEnum.polarLinearAxis:
      return getPolarAxisTheme(componentSpec.orient, 'linear', getTheme);
    case ComponentTypeEnum.polarAxis:
      return getPolarAxisTheme(componentSpec.orient, undefined, getTheme);
    case ComponentTypeEnum.cartesianCrosshair:
      return getCartesianCrosshairTheme(getTheme, chartSpec);
    case ComponentTypeEnum.polarCrosshair:
      return getPolarCrosshairTheme(getTheme, chartSpec);
    case ComponentTypeEnum.colorLegend:
    case ComponentTypeEnum.sizeLegend:
    case ComponentTypeEnum.discreteLegend:
    case ComponentTypeEnum.dataZoom:
    case ComponentTypeEnum.scrollBar:
      return getComponentThemeWithDirection(componentSpec, getComponentThemeFromOption(type, getTheme));
    default:
      return getComponentThemeFromOption(type, getTheme);
  }
}

export const getComponentThemeWithDirection = <T>(
  componentSpec: { orient?: IOrientType },
  originalTheme: ComponentThemeWithDirection<T>
): T => {
  const orient = componentSpec.orient ?? originalTheme.orient;
  const directionTheme = originalTheme[getDirectionByOrient(orient)];
  const finalTheme = mergeSpec({}, originalTheme, directionTheme);

  delete finalTheme[Direction.horizontal];
  delete finalTheme[Direction.vertical];
  return finalTheme;
};
