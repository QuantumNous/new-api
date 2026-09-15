import type { DataView } from '@visactor/vdataset';
import type { Datum } from '../../typings';
import { couldBeValidNumber } from '../../util/type';
import { getPercentValue } from '../../util/math';
import { ARC_TRANSFORM_VALUE } from '../../constant/polar';
import { computeQuadrant, isNil } from '@visactor/vutils';

export interface IPieOpt {
  angleField: () => string;
  startAngle: () => number;
  endAngle: () => number;
  minAngle: () => number;

  asStartAngle: string;
  asEndAngle: string;
  asMiddleAngle: string;
  asRadian: string;
  asRatio: string;
  asQuadrant: string;
  asK: string;
  showAllZero: boolean;
  supportNegative: boolean;
  showEmptyCircle: boolean;
}

function transformInvalidValue(value: any) {
  if (!couldBeValidNumber(value)) {
    return 0;
  }
  return Number.parseFloat(value);
}

export const pie = (originData: Array<DataView>, op: IPieOpt) => {
  const {
    asStartAngle,
    asEndAngle,
    asMiddleAngle,
    asRadian,
    asRatio,
    asQuadrant,
    asK,
    showAllZero,
    supportNegative,
    showEmptyCircle
  } = op;

  const angleField = op.angleField();
  const startAngle = op.startAngle();
  const endAngle = op.endAngle();
  const minAngle = op.minAngle();

  const data = originData.map((datum: Datum) => ({ ...datum }));
  if (!data || data.length === 0) {
    return data;
  }

  if (!showAllZero && showEmptyCircle && isDataEmpty(data, angleField, supportNegative)) {
    return [];
  }

  const appendArcInfo = (data: Datum, startAngle: number, angle: number) => {
    data[asStartAngle] = startAngle;
    data[asEndAngle] = startAngle + angle;
    data[asMiddleAngle] = startAngle + angle / 2;
    data[asRadian] = angle;
    data[asQuadrant] = computeQuadrant(startAngle + angle / 2);
  };

  let total = 0;
  let max = -Infinity;
  let isAllZero = true;
  for (let index = 0; index < data.length; index++) {
    const angleFieldValue = supportNegative
      ? Math.abs(transformInvalidValue(data[index][angleField]))
      : transformInvalidValue(data[index][angleField]);
    total += angleFieldValue;
    max = Math.max(angleFieldValue, max);
    if (isAllZero && angleFieldValue !== 0) {
      isAllZero = false;
    }

    data[index][ARC_TRANSFORM_VALUE] = angleFieldValue;
  }

  const valueList = data.map(d => Number(d[angleField]));
  const angleRange = endAngle - startAngle;
  let lastAngle = startAngle;
  let restAngle = angleRange;
  let largeThanMinAngleTotal = 0;
  const percents = getPercentValue(valueList);

  data.forEach((d, i) => {
    const angleFieldValue = d[ARC_TRANSFORM_VALUE];
    const ratio = total ? angleFieldValue / total : 0;
    let radian = ratio * angleRange;

    if (radian < minAngle) {
      radian = minAngle;
      restAngle -= minAngle;
    } else {
      largeThanMinAngleTotal += angleFieldValue;
    }

    const dStartAngle = lastAngle;
    const dEndAngle = lastAngle + radian;

    d[asRatio] = ratio;
    d[asK] = max ? angleFieldValue / max : 0;
    d._percent_ = (percents as number[])[i];
    appendArcInfo(d, dStartAngle, radian);

    lastAngle = dEndAngle;
  });

  if (restAngle < angleRange) {
    if (restAngle <= 1e-3) {
      const angle = angleRange / data.length;
      data.forEach((d, index) => {
        appendArcInfo(d, startAngle + index * angle, angle);
      });
    } else {
      const unitRadian = restAngle / largeThanMinAngleTotal;
      lastAngle = startAngle;
      data.forEach(d => {
        const angle = d[asRadian] === minAngle ? minAngle : d[ARC_TRANSFORM_VALUE] * unitRadian;
        appendArcInfo(d, lastAngle, angle);

        lastAngle += angle;
      });
    }
  }

  if (total !== 0) {
    // 数据都为 0 时，起始角和结束角相同，不应该强制赋值
    // 防止一个扇区的角度会因为浮点数精度问题和传入的 endAngle 不相等
    data[data.length - 1][asEndAngle] = endAngle;
  }

  if (isAllZero && showAllZero) {
    const angle = angleRange / data.length;
    data.forEach((d, index) => {
      appendArcInfo(d, startAngle + index * angle, angle);
    });
  }
  return data;
};

export const isDataEmpty = (data: Datum[], angleField: string, supportNegative: boolean) => {
  if (isNil(data)) {
    return true;
  }
  if (data.length === 0) {
    return true;
  }
  if (data.every(datum => transformInvalidValue(datum[angleField]) === 0)) {
    return true;
  }
  // 未支持负数, 并且和为0, 则也认为是空数据
  if (!supportNegative && data.reduce((sum, datum) => sum + transformInvalidValue(datum[angleField]), 0) === 0) {
    return true;
  }

  return false;
};
