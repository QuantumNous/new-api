import type { IChart } from '../../../../chart/interface';
import type { IDimensionInfo } from '../interface';
import { isDiscrete } from '@visactor/vscale';
import { getDimensionData, getAxis } from './common';
import type { CartesianAxis } from '../../../../component/axis/cartesian';
import type { ICartesianSeries } from '../../../../series/interface';
import { isNil } from '@visactor/vutils';
import { isXAxis, isYAxis } from '../../../../component/axis/cartesian/util/common';
import { Direction } from '../../../../typings/space';
import type { ILayoutPoint } from '../../../../typings/layout';
import type { IAxis } from '../../../../component/axis';

const discreteXAxisGetDimensionField = (series: ICartesianSeries) => series.fieldX[0];
const discreteYAxisGetDimensionField = (series: ICartesianSeries) => series.fieldY[0];
const continuousXAxisGetDimensionField = (series: ICartesianSeries) => [
  series.fieldX[0],
  series.fieldX2 ?? series.fieldX[1]
];
const continuousYAxisGetDimensionField = (series: ICartesianSeries) => [
  series.fieldY[0],
  series.fieldY2 ?? series.fieldY[1]
];

const getDimensionFieldFunc = (isXAxis: boolean, isDiscreteAxis: boolean) =>
  isXAxis
    ? isDiscreteAxis
      ? discreteXAxisGetDimensionField
      : continuousXAxisGetDimensionField
    : isDiscreteAxis
    ? discreteYAxisGetDimensionField
    : continuousYAxisGetDimensionField;

export const getCartesianDimensionInfo = (
  chart: IChart | undefined,
  pos: ILayoutPoint,
  isTooltip?: boolean
): IDimensionInfo[] | null => {
  if (!chart) {
    return null;
  }

  const { x, y } = pos;
  const xAxisList = getAxis(chart, (cmp: CartesianAxis) => isXAxis(cmp.getOrient()), pos) ?? [];
  const yAxisList = getAxis(chart, (cmp: CartesianAxis) => isYAxis(cmp.getOrient()), pos) ?? [];

  if (!xAxisList.length && !yAxisList.length) {
    return null;
  }

  /** 离散轴集合 */
  const bandAxisSet: Set<CartesianAxis> = new Set();
  /** 连续轴集合 */
  const linearAxisSet: Set<CartesianAxis> = new Set();
  /** 必须包含的轴的集合 */
  const forceAxisSet: Set<CartesianAxis> = new Set();

  [xAxisList, yAxisList].forEach(axisList =>
    axisList.forEach(axis => {
      const isDiscreteAxis = isDiscrete(axis.getScale().type);
      if (isDiscreteAxis) {
        bandAxisSet.add(axis);
      } else {
        linearAxisSet.add(axis);
      }
      if (isTooltip && axis.getSpec().hasDimensionTooltip) {
        forceAxisSet.add(axis);
      }
    })
  );

  const targetAxisInfo: IDimensionInfo[] = [];

  const addAxisDimensionInfo = (orient: 'x' | 'y') => {
    const isXAxis = orient === 'x';
    const posValue = isXAxis ? x : y;
    const axisList = isXAxis ? xAxisList : yAxisList;
    axisList.forEach(axis => {
      if (forceAxisSet.size > 0) {
        if (forceAxisSet.has(axis)) {
          const info = getDimensionInfoByPosition(
            axis,
            posValue,
            getDimensionFieldFunc(isXAxis, isDiscrete(axis.getScale().type))
          );
          info && targetAxisInfo.push(info);
        }
      } else {
        const hasDiscreteAxis = bandAxisSet.size > 0;
        if ((hasDiscreteAxis ? bandAxisSet : linearAxisSet).has(axis)) {
          const info = getDimensionInfoByPosition(axis, posValue, getDimensionFieldFunc(isXAxis, hasDiscreteAxis));
          info && targetAxisInfo.push(info);
        }
      }
    });
  };

  // 优先筛选 band 轴，其次按照 direction 判断
  if (chart.getSpec().direction === Direction.horizontal) {
    addAxisDimensionInfo('y');
    if (targetAxisInfo.length === 0) {
      addAxisDimensionInfo('x');
    }
  } else {
    addAxisDimensionInfo('x');
    if (targetAxisInfo.length === 0) {
      addAxisDimensionInfo('y');
    }
  }

  if (!targetAxisInfo.length) {
    return null;
  }
  return targetAxisInfo;
};

export const getDimensionInfoByPosition = (
  axis: CartesianAxis,
  posValue: number,
  getDimensionField: (series: ICartesianSeries) => string | string[]
): IDimensionInfo | null => {
  const value = axis.positionToData(posValue, true);
  return isNil(value) ? null : getDimensionInfoByValue(axis, value, getDimensionField);
};

export const getDimensionInfoByValue = (
  axis: IAxis,
  value: any,
  getDimensionField?: (series: ICartesianSeries) => string | string[]
): IDimensionInfo | null => {
  const scale = axis.getScale();

  if (isNil(value)) {
    return null;
  }
  const domain = scale.domain();
  let index: number | undefined = domain.findIndex((v: any) => v?.toString() === value.toString());
  if (index < 0) {
    index = undefined;
  }

  const data = getDimensionData(
    value,
    axis as CartesianAxis,
    'cartesian',
    getDimensionField ??
      (isXAxis((axis as CartesianAxis).getOrient()) ? discreteXAxisGetDimensionField : discreteYAxisGetDimensionField)
  );
  return { index, value, position: scale.scale(value), axis, data };
};
