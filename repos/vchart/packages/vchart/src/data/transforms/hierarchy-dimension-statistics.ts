import { isFunction } from '@visactor/vutils';
import { dimensionStatistics } from './dimension-statistics';
import type { DataView } from '@visactor/vdataset';
import { flatten } from './flatten';
import type { Datum } from '../../typings';
import type { IStatisticsOption } from './interface';

/**
 * 层次聚合统计主要用于处理层次数据(诸如统计平均值,求和等),并返回计算后的数据结果
 * @param data
 * @param options
 * @returns
 */
export const hierarchyDimensionStatistics = (data: Array<DataView>, op: IStatisticsOption) => {
  let result = {};
  let fields = op.fields;
  if (isFunction(fields)) {
    fields = fields();
  }
  if (!fields?.length || !data?.length) {
    return result;
  }

  if (!data[0].latestData) {
    return result;
  }

  const hierarchyData = data[0].latestData as Datum[];
  const flatData = flatten(hierarchyData);
  result = dimensionStatistics([{ latestData: flatData } as any], op);
  return result;
};
