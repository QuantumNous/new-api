import { get, isFunction, isNil, isPlainObject, isValid } from '@visactor/vutils';
import type {
  Datum,
  TooltipContentCallback,
  TooltipContentProperty,
  TooltipData,
  TooltipPatternProperty
} from '../../../typings';
import type { TooltipHandlerParams } from '../interface';
import { getFormatFunction } from '../../util';
import type { IDimensionData, IDimensionInfo } from '../../../event';

export const getTooltipContentValue = <T>(
  field?: TooltipContentProperty<T>,
  datum?: any,
  params?: TooltipHandlerParams,
  formatter?: string
): T | undefined => {
  let value: T;
  if (isFunction(field)) {
    value = (field as TooltipContentCallback<T>)(datum, params);
  } else if (isPlainObject(field) && isValid(field.field)) {
    value = get(datum, field.field) as T;
  } else {
    value = field as T;
  }

  if (formatter) {
    const { formatFunc, args } = getFormatFunction(undefined, formatter, field as string, datum);
    if (formatFunc && args) {
      value = formatFunc(...args);
    }
  }

  return value;
};

export const getTooltipPatternValue = <T>(
  field?: TooltipPatternProperty<T>,
  data?: TooltipData,
  params?: TooltipHandlerParams
): T | undefined => {
  if (isNil(field)) {
    return field as undefined;
  }
  if (isFunction(field)) {
    return (field as TooltipContentCallback<T>)(data, params);
  }
  return field as T;
};

export function getFirstDatumFromTooltipData(data: TooltipData): Datum {
  // 找到第一个可用的datum
  const dimInfoList: IDimensionInfo[] = (data as IDimensionData[])[0]?.series
    ? [{ data: data as IDimensionData[], value: '' }]
    : (data as IDimensionInfo[]);
  for (const { data: dataList } of dimInfoList) {
    for (const { datum: datumList } of dataList) {
      for (const datumItem of datumList ?? []) {
        if (datumItem) {
          return datumItem;
        }
      }
    }
  }
  return undefined;
}
