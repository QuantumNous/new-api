import {
  isNil,
  isNumber,
  degreeToRadian,
  isArray,
  isFunction,
  field as getFieldAccessor,
  extent,
  toPercent
} from '@visactor/vutils';
import { CORRELATION_X, CORRELATION_Y, CORRELATION_SIZE } from '../../constant/correlation';

type CorrelationOptionValue<T> = T | (() => T);
type CorrelationDatum = Record<string, unknown>;

export interface ICorrelationOpt {
  view: () => { x0: number; x1: number; y0: number; y1: number };
  field: CorrelationOptionValue<string>;
  radiusField?: CorrelationOptionValue<string | undefined>;
  radiusRange?: CorrelationOptionValue<[number, number] | undefined>;
  center?: CorrelationOptionValue<[string | number, string | number] | undefined>;
  startAngle?: CorrelationOptionValue<number | undefined>;
  endAngle?: CorrelationOptionValue<number | undefined>;
  innerRadius?: CorrelationOptionValue<string | number | undefined>;
  outerRadius?: CorrelationOptionValue<string | number | undefined>;
}

interface CorrelationLayoutItem {
  x: number;
  y: number;
  size: number;
}

export type CircularRelationItem = Record<string, unknown>;

const resolveOptionValue = <T>(option: CorrelationOptionValue<T>) => (isFunction(option) ? option() : option);

export const correlation = (data: unknown, options: ICorrelationOpt) => {
  if (!data || !options?.view || !isArray(data)) {
    return data;
  }
  const dataList = data as CorrelationDatum[];

  const viewBox = options.view();

  if (
    viewBox.x1 - viewBox.x0 === 0 ||
    viewBox.y1 - viewBox.y0 === 0 ||
    viewBox.x1 - viewBox.x0 === -Infinity ||
    viewBox.x1 - viewBox.x0 === Infinity ||
    viewBox.y1 - viewBox.y0 === -Infinity ||
    viewBox.y1 - viewBox.y0 === Infinity
  ) {
    return data;
  }

  const startAngle = degreeToRadian(resolveOptionValue(options.startAngle) ?? -90);
  const endAngle = degreeToRadian(resolveOptionValue(options.endAngle) ?? 270);
  const maxRadius = Math.max((viewBox.x1 - viewBox.x0) / 2, (viewBox.y1 - viewBox.y0) / 2);
  const innerRadius = toPercent(resolveOptionValue(options.innerRadius) ?? 0, maxRadius);
  const outerRadius = toPercent(resolveOptionValue(options.outerRadius), maxRadius);
  const centerOption = resolveOptionValue(options.center);

  const center = [
    isNumber(centerOption?.[0])
      ? centerOption[0]
      : viewBox.x0 + toPercent(centerOption?.[0] ?? '50%', viewBox.x1 - viewBox.x0),
    isNumber(centerOption?.[1])
      ? centerOption[1]
      : viewBox.y0 + toPercent(centerOption?.[1] ?? '50%', viewBox.y1 - viewBox.y0)
  ] as [number, number];
  const fieldAccessor = getFieldAccessor(resolveOptionValue(options.field));
  const values = dataList.map(fieldAccessor);
  const [min, max] = extent(values);
  const radiusScale =
    min === max
      ? (val: number) => (innerRadius + outerRadius) / 2
      : (val: number) => innerRadius + ((outerRadius - innerRadius) * (val - min)) / (max - min);

  const radiusField = resolveOptionValue(options.radiusField);
  const radiusRange = resolveOptionValue(options.radiusRange);
  const sizeAccessor = !isNil(radiusField) ? getFieldAccessor(radiusField) : fieldAccessor;
  const defaultSize = radiusRange?.[1] ?? 5;
  let sizeScale = (datum: CorrelationDatum) => defaultSize;

  if (sizeAccessor) {
    const [minSize, maxSize] = sizeAccessor !== fieldAccessor ? extent(dataList.map(sizeAccessor)) : [min, max];
    const minR = radiusRange?.[0] ?? 5;
    const maxR = radiusRange?.[1] ?? 5;

    if (minSize !== maxSize) {
      sizeScale = (datum: CorrelationDatum) =>
        minR + ((maxR - minR) * (sizeAccessor(datum) - minSize)) / (maxSize - minSize);
    }
  }

  const minAngle = Math.min(startAngle, endAngle);
  const maxAngle = Math.max(startAngle, endAngle);
  const angles = getPartialAngles(minAngle, maxAngle, dataList.length);

  const res: CircularRelationItem[] = [];
  const searchStep = 60;
  const searchAngle = (maxAngle - minAngle) / searchStep;

  dataList.forEach((datum, index) => {
    const radius = radiusScale(values[index] as number);
    const size = sizeScale(datum);
    let x: number;
    let y: number;
    let angle = angles[index];

    for (let i = 0; i < searchStep; i++) {
      x = center[0] + radius * Math.cos(angle);
      y = center[1] + radius * Math.sin(angle);

      if (
        hasOverlap({ x, y, size }, res) ||
        x - size < viewBox.x0 ||
        x + size > viewBox.x1 ||
        y - size < viewBox.y0 ||
        y + size > viewBox.y1
      ) {
        if (i < searchStep - 1) {
          angle += searchAngle;

          if (angle > maxAngle) {
            angle = minAngle;
          } else if (angle < minAngle) {
            angle = maxAngle;
          }
        }
        continue;
      } else {
        break;
      }
    }

    res.push({ [CORRELATION_X]: x, [CORRELATION_Y]: y, [CORRELATION_SIZE]: size, ...datum });
  });
  return res;
};

const getPartialAngles = (minAngle: number, maxAngle: number, count: number) => {
  let offsetAngle = 0;
  let stepCount = Math.max(Math.ceil((2 * (maxAngle - minAngle)) / Math.PI), 2);
  let stepAngle = (maxAngle - minAngle) / stepCount;
  let stepIndex = 0;
  let stepSign = 1;
  let i = 0;
  let j = 0;
  const res: number[] = [];
  let startAngle = minAngle;

  while (i < count) {
    if (j < stepCount) {
      res.push(startAngle + (j % 2 ? Math.floor(j / 2) + Math.floor(stepCount / 2) : j / 2) * stepAngle * stepSign);
      j++;
    }

    i++;

    if (j === stepCount) {
      j = 0;
      stepIndex += 1;
      stepSign *= -1;

      if (offsetAngle === 0) {
        offsetAngle = stepAngle / 2;
      } else {
        offsetAngle /= 2;
      }
      startAngle = stepSign === -1 ? maxAngle - offsetAngle : minAngle + offsetAngle;

      if (stepIndex >= 2) {
        stepAngle /= 2;
        stepCount *= 2;
      }
    }
  }

  return res;
};

const hasOverlap = (item: CorrelationLayoutItem, arr: CircularRelationItem[]) => {
  if (!arr || !arr.length) {
    return false;
  }

  return arr.some(entry => {
    const x = entry.x as number;
    const y = entry.y as number;
    const size = entry.size as number;
    return Math.pow(item.x - x, 2) + Math.pow(item.y - y, 2) < Math.pow(item.size + size, 2);
  });
};
