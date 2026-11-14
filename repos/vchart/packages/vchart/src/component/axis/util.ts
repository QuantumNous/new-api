import { get } from '@visactor/vutils';
import type { AxisType, ICommonAxisSpec, ILinearAxisSpec } from './interface';
import { transformComponentStyle } from '../../util/style';
import type { IAxisHelper } from './cartesian/interface/common';
import type { IPolarAxisHelper } from './polar/interface/common';

export const DEFAULT_TITLE_STYLE = {
  left: {
    textAlign: 'center',
    textBaseline: 'bottom'
  },
  right: {
    textAlign: 'center',
    textBaseline: 'bottom'
  },
  radius: {},
  angle: {}
};

export function transformAxisLineStyle(lineCfg: any) {
  lineCfg = transformComponentStyle(lineCfg);
  lineCfg.startSymbol = transformComponentStyle(lineCfg.startSymbol);
  lineCfg.endSymbol = transformComponentStyle(lineCfg.endSymbol);

  return lineCfg;
}

export function getAxisLabelOffset(axisSpec: ICommonAxisSpec) {
  let labelOffset = 0;
  if (get(axisSpec, 'tick.visible')) {
    labelOffset += get(axisSpec, 'tick.tickSize');
  }

  if (get(axisSpec, 'label.visible')) {
    labelOffset += get(axisSpec, 'label.space');
  }

  return labelOffset;
}

export function getLinearAxisSpecDomain(
  axisSpec: ILinearAxisSpec,
  defaultDomain?: {
    min?: number;
    max?: number;
  }
) {
  // 兼容策略
  return {
    min: axisSpec.min ?? axisSpec.range?.min ?? defaultDomain?.min,
    max: axisSpec.max ?? axisSpec.range?.max ?? defaultDomain?.max
  };
}

export function isValidCartesianAxis(spec: any) {
  const orient = spec?.orient;
  return orient === 'top' || orient === 'bottom' || orient === 'left' || orient === 'right' || orient === 'z';
}

export function isValidPolarAxis(spec: any) {
  const orient = spec?.orient;
  return orient === 'angle' || orient === 'radius';
}

export const isDiscreteAxis = (axisType: AxisType) =>
  axisType === 'band' || axisType === 'ordinal' || axisType === 'point';

export function getAxisItem(value: any, normalizedValue: number) {
  return {
    id: value,
    label: value,
    value: normalizedValue,
    rawValue: value
  };
}

// 更新的条件: 指定绑定关系 或 初次绑定 或 更新前后id一致(防止声明多个轴时, 后面的轴覆盖前面的轴)
export function shouldUpdateAxis(
  preHelper: IAxisHelper | IPolarAxisHelper,
  curHelper: IAxisHelper | IPolarAxisHelper,
  forceUpdate: boolean
) {
  return forceUpdate || !preHelper || preHelper.getAxisId() === curHelper.getAxisId();
}
