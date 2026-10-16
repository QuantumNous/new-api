import type { Tag } from '@visactor/vrender-components';
import type { IBoundsLike } from '@visactor/vutils';
import type { Datum } from '../../../typings';
import type { ICrosshairTheme } from '../interface';
// eslint-disable-next-line no-duplicate-imports
import { array, isValid } from '@visactor/vutils';
import { isXAxis, isYAxis } from '../../axis/cartesian/util/common';
import { isDiscrete } from '@visactor/vscale';
import type { ICartesianAxisCommonSpec, IPolarAxisCommonSpec } from '../../axis';
import { getComponentThemeFromOption } from '../../util';
import { ComponentTypeEnum } from '../../interface/type';
import { isDiscreteAxis } from '../../axis/util';
import { mergeSpec } from '@visactor/vutils-extension';

export function limitTagInBounds(shape: Tag, bounds: IBoundsLike) {
  const { x1: regionMinX, y1: regionMinY, x2: regionMaxX, y2: regionMaxY } = bounds;
  const { x1, y1, x2, y2 } = shape.AABBBounds;
  const { dx: originDx = 0, dy: originDy = 0 } = shape.attribute;

  let dx = 0;
  let dy = 0;
  if (x1 < regionMinX) {
    // 超出左侧
    dx = regionMinX - x1;
  }
  if (y1 < regionMinY) {
    // 超出顶部
    dy = regionMinY - y1;
  }

  if (x2 > regionMaxX) {
    // 超出右侧
    dx = regionMaxX - x2;
  }

  if (y2 > regionMaxY) {
    // 整体超出顶部
    dy = regionMaxY - y2;
  }
  if (dx) {
    shape.setAttribute('dx', dx + originDx);
  }
  if (dy) {
    shape.setAttribute('dy', dy + originDy);
  }
}

/**
 * 查找系列中的数据
 * @todo 待重构优化，和 `getDimensionData` 中的逻辑存在重合
 * @param data 系列数据
 * @param value 数据值
 * @param startField 开始值对应的字段
 * @param endField   结束值对应的字段
 * @returns 系列数据
 */
export function getDatumByValue(data: Datum[], value: number, startField: string, endField?: string): Datum | null {
  for (let i = 0, len = data.length; i < len; i++) {
    const record = data[i];

    if (record) {
      const startValue = record[startField];
      const endValue = record[endField || startField];

      if (startValue <= value && endValue >= value) {
        return record;
      }
    }
  }

  return null;
}

export const getCartesianCrosshairTheme = (getTheme: (...keys: string[]) => any, chartSpec: any): ICrosshairTheme => {
  const axes: ICartesianAxisCommonSpec[] = array(chartSpec.axes ?? []);
  const { bandField, linearField, xField, yField, trigger, triggerOff } =
    getComponentThemeFromOption(ComponentTypeEnum.crosshair, getTheme) ?? {};

  const xAxis = axes.find(axis => isXAxis(axis.orient));
  let newXField;
  if (isValid(xAxis)) {
    newXField = mergeSpec({}, isDiscreteAxis(xAxis.type) ? bandField : linearField, xField);
  } else {
    newXField = xField;
  }

  const yAxis = axes.find(axis => isYAxis(axis.orient));
  let newYField;
  if (isValid(yAxis)) {
    newYField = mergeSpec({}, isDiscrete(yAxis.type) ? bandField : linearField, yField);
  } else {
    newYField = yField;
  }

  // 返回主题配置，包括交互相关配置
  return {
    xField: newXField,
    yField: newYField,
    trigger,
    triggerOff
  };
};

export const getPolarCrosshairTheme = (getTheme: (...keys: string[]) => any, chartSpec: any): ICrosshairTheme => {
  const axes: IPolarAxisCommonSpec[] = array(chartSpec.axes ?? []);
  const { bandField, linearField, categoryField, valueField, trigger, triggerOff } =
    getComponentThemeFromOption(ComponentTypeEnum.crosshair, getTheme) ?? {};

  const angleAxis = axes.find(axis => axis.orient === 'angle');
  let newAngleField;
  if (isValid(angleAxis)) {
    newAngleField = mergeSpec({}, isDiscreteAxis(angleAxis.type) ? bandField : linearField, categoryField);
  } else {
    newAngleField = categoryField;
  }

  const radiusAxis = axes.find(axis => axis.orient === 'radius');
  let newRadiusField;
  if (isValid(radiusAxis)) {
    newRadiusField = mergeSpec({}, isDiscrete(radiusAxis.type) ? bandField : linearField, valueField);
  } else {
    newRadiusField = valueField;
  }

  // 返回主题配置，包括交互相关配置
  return {
    categoryField: newAngleField,
    valueField: newRadiusField,
    trigger,
    triggerOff
  };
};
