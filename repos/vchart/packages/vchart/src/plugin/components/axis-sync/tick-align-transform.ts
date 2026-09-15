import type { Datum } from '../../../typings';
import type { CartesianAxis } from '../../../component';
import { convertDomainToTickData } from '@visactor/vrender-components/axis/tick-data/util';
import { last, precisionSub, getDecimalPlaces } from '@visactor/vutils';

export interface ITickAlignOpt {
  targetAxis: () => CartesianAxis;
  currentAxis: () => CartesianAxis;
}

function saveTick(value: number, minInput: number, inputRange: number, minOutput: number, outputRange: number) {
  const sub = precisionSub(value, minInput);
  const decimalPlaces = Math.max(getDecimalPlaces(inputRange), getDecimalPlaces(sub));
  const percent = Math.round(sub * 10 ** decimalPlaces) / Math.round(inputRange * 10 ** decimalPlaces);
  return outputRange * percent + minOutput;
}

export const tickAlign = (data: Array<Datum>, op: ITickAlignOpt) => {
  if (!data) {
    return data;
  }
  // check align enable
  const targetAxis = op?.targetAxis?.();
  if (!targetAxis) {
    return data;
  }
  const currentAxis = op?.currentAxis?.();
  if (!currentAxis) {
    return data;
  }
  const currentData = currentAxis.getTickData()?.getDataView();
  if (!currentData) {
    return data;
  }
  // TODO 这种方法有点hack
  const currentTickTransform = currentData.transformsArr.find(t => t.type.includes('ticks'));
  if (!currentTickTransform) {
    return data;
  }
  const currentScale = currentAxis.getScale();
  if (!currentScale) {
    return data;
  }
  const targetData = targetAxis.getTickData()?.getDataView()?.latestData;
  if (!targetData?.length) {
    return data;
  }
  const targetScale = targetAxis.getScale();
  if (!targetScale) {
    return data;
  }
  const targetDomain = targetScale.domain();
  const targetRange = last(targetDomain) - targetDomain[0];
  if (targetRange === 0) {
    return data;
  }
  const currentDomain = currentScale.domain();
  const currentRange = last(currentDomain) - currentDomain[0];
  if (targetRange === 0) {
    return data;
  }
  // make the tickData of the current axis consistent with the tickData of the target axis
  const newTicks: number[] = targetData.map((d: { value: number }) =>
    saveTick(d.value, targetDomain[0], targetRange, currentDomain[0], currentRange)
  );
  return convertDomainToTickData(newTicks);
};
