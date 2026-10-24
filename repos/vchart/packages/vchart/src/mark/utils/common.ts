import { MarkTypeEnum } from '../interface/type';
import type { Datum } from '../../typings';
import { Direction } from '../../typings';
import type { GroupedData } from '../interface/common';
import { DEFAULT_KEY } from '../../constant/data';

export const MultiDatumMark = [MarkTypeEnum.line, MarkTypeEnum.area, 'trail'];

export function isMultiDatumMark(type: MarkTypeEnum) {
  return MultiDatumMark.includes(type);
}

export function curveTypeTransform(type: string, direction: string) {
  if (type === 'monotone') {
    return direction === Direction.horizontal ? 'monotoneY' : 'monotoneX';
  }
  return type;
}

export function groupData<T>(
  data: T[],
  groupBy: (datum: Datum, index: number) => string,
  sort?: (a: T, b: T) => number
): GroupedData<T> {
  const groupedData = new Map();
  if (!data || data.length === 0) {
    return { keys: [], data: groupedData };
  }
  if (!groupBy) {
    groupedData.set(DEFAULT_KEY, sort ? data.slice().sort(sort) : data.slice());
    return { keys: [DEFAULT_KEY], data: groupedData };
  }
  // const keyGetter = parseField(key);

  if (data.length === 1) {
    const key = groupBy(data[0], 0);
    groupedData.set(key, [data[0]]);

    return {
      keys: [key],
      data: groupedData
    };
  }

  const keys = new Set<string>();
  data.forEach((entry, index) => {
    const key = groupBy(entry, index);
    const lastData = groupedData.get(key) ?? [];
    lastData.push(entry);
    groupedData.set(key, lastData);
    keys.add(key);
  });
  if (sort) {
    keys.forEach(key => {
      groupedData.get(key).sort(sort);
    });
  }
  return { keys: Array.from(keys), data: groupedData };
}

export const runEncoder = (styles: Record<string, (datum: Datum) => any>, datum: Datum, attrs: any = {}) => {
  styles &&
    Object.keys(styles).forEach(attrName => {
      attrs[attrName] = styles[attrName](datum);
    });

  return attrs;
};
