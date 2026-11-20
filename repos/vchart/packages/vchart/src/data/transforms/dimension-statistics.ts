import { isNil, isFunction, minInArray, maxInArray } from '@visactor/vutils';
import type { IFieldsMeta } from '../../typings/spec';
import { couldBeValidNumber } from '../../util/type';
import { mergeFields } from '../../util/data';
import type { DataView } from '@visactor/vdataset';
import type { Datum } from '../../typings';
import type { IStatisticsOption, StatisticOperations } from './interface';

const methods = {
  min: (arr: any[]) => {
    return arr.length ? minInArray(arr.map(n => n * 1)) : 0;
  },
  max: (arr: any[]) => {
    return arr.length ? maxInArray(arr.map(n => n * 1)) : 0;
  },
  'array-min': (arr: any[]) => {
    return arr.length ? minInArray(arr.map(n => n * 1)) : 0;
  },
  'array-max': (arr: any[]) => {
    return arr.length ? maxInArray(arr.map(n => n * 1)) : 0;
  },
  values: (arr: any[]) => {
    const map = {};
    const res: any[] = [];

    for (const entry of arr) {
      if (!map[entry]) {
        res.push(entry);
        map[entry] = 1;
      }
    }

    return res;
  }
};

/**
 * 聚合统计主要用于处理数据(诸如统计平均值,求和等),并返回计算后的数据结果
 * @param data
 * @param options
 * @returns
 */
export const dimensionStatistics = (data: Array<DataView>, op: IStatisticsOption) => {
  // const operations = op.operations;
  let fields = op.fields;
  if (isFunction(fields)) {
    fields = fields();
  }
  if (!fields?.length || !data?.length) {
    return {};
  }

  // merge same key
  fields = mergeFields([], fields);

  const dataKey = op.target === 'parser' ? 'parserData' : 'latestData';
  const latestData = data[0][dataKey] ? data[0][dataKey] : data || [];
  const dataFields = data[0].getFields?.() as Record<
    /** 字段key */
    string,
    IFieldsMeta
  >;

  return dimensionStatisticsOfSimpleData(latestData, fields, dataFields);
};

/**
 * 聚合统计主要用于处理数据(诸如统计平均值,求和等),并返回计算后的数据结果
 * @param data
 * @param options
 * @returns
 */
export const dimensionStatisticsOfSimpleData = (
  latestData: Datum[],
  fields: {
    key: string;
    operations: StatisticOperations;
    filter?: (fv: any) => boolean;
    customize?: { max: number; min: number } | any[];
  }[],
  dataFields?: Record<
    /** 字段key */
    string,
    IFieldsMeta
  >
) => {
  const result = {};

  let fValues: any[] = [];
  let nextFValues: any[] = [];
  fields.forEach(f => {
    const key = f.key;
    // NOTE: the same key in fields has been merge already
    result[key] = {};
    const dataFieldInKey = dataFields?.[key];
    const operations: StatisticOperations = f.operations;
    const isNumberField = operations.some(op => op === 'min' || op === 'max' || op === 'allValid');
    let allValid = true;
    fValues.length = 0;

    latestData &&
      latestData.forEach((d: Datum) => {
        if (d) {
          fValues.push(d[key]);
        }
      });
    const len = fValues.length;

    if (isNumberField) {
      nextFValues.length = 0;
      fValues.forEach((item, i) => {
        if (couldBeValidNumber(item)) {
          nextFValues.push(item);
        }
      });
      const t = fValues;
      fValues = nextFValues;
      nextFValues = t;
      // fValues = fValues.filter(couldBeValidNumber);
      allValid = fValues.length === len;
    } else if (operations.some(op => op === 'array-min' || op === 'array-max')) {
      fValues = fValues.reduce((res, entry) => {
        if (entry) {
          entry.forEach((d: any) => {
            if (couldBeValidNumber(d)) {
              res.push(d);
            }
          });
        }

        return res;
      }, []);
    } else {
      fValues = fValues.filter((entry: any) => entry !== undefined);
    }

    if (f.filter) {
      fValues = fValues.filter(f.filter);
    }

    operations.forEach(op => {
      // @chensij 如果指定了计算的domain结果，则忽略计算（目前该逻辑仅在dot series中维护，因为dot series期望在filter data之后x轴改变domain，y轴不改变domain）
      if (f.customize) {
        result[key][op] = f.customize;
      } else {
        if (dataFieldInKey && dataFieldInKey.lockStatisticsByDomain === true && !isNil(dataFieldInKey.domain)) {
          if (op === 'values') {
            result[key][op] = dataFieldInKey.domain.slice();
            return;
          }
        } else if (op === 'allValid') {
          return;
        }

        result[key][op] = methods[op](fValues);

        if (op === 'array-max') {
          result[key].max = result[key][op];
        }
        if (op === 'array-min') {
          result[key].min = result[key][op];
        }
      }
    });

    if (isNumberField) {
      result[key].allValid = allValid;
    }
  });

  return result;
};
