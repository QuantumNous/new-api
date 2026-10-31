import type { DataView } from '@visactor/vdataset';
import type { StatisticOperations } from '../data/transforms/interface';
import {
  STACK_FIELD_END,
  STACK_FIELD_START_PERCENT,
  STACK_FIELD_END_PERCENT,
  STACK_FIELD_END_OffsetSilhouette,
  STACK_FIELD_START_OffsetSilhouette,
  STACK_FIELD_TOTAL,
  STACK_FIELD_TOTAL_PERCENT,
  STACK_FIELD_TOTAL_TOP,
  STACK_FIELD_START,
  STACK_FIELD_KEY,
  STACK_FIELD_TOTAL_BOTTOM,
  MOSAIC_CAT_START_PERCENT,
  MOSAIC_CAT_END_PERCENT,
  MOSAIC_VALUE_START_PERCENT,
  MOSAIC_VALUE_END_PERCENT
} from '../constant/data';
import { isValid, toValidNumber } from './type';
import { max, sum } from './math';
import type { ISeries, ISeriesStackDataMeta } from '../series/interface';
import type { IRegion } from '../region/interface';
import { MosaicSeries } from '../series';

export function mergeFields(
  targetFields: {
    key: string;
    operations: StatisticOperations;
  }[],
  mergeFields: {
    key: string;
    operations: StatisticOperations;
  }[]
): {
  key: string;
  operations: StatisticOperations;
}[] {
  for (let i = 0; i < mergeFields.length; i++) {
    const element = mergeFields[i];
    const _target = findFields(targetFields, element.key);
    if (!_target) {
      targetFields.push(element);
    } else {
      _target.operations = [...new Set(_target.operations.concat(element.operations))];
    }
  }
  return targetFields;
}

function findFields(
  list: {
    key: string;
    operations: StatisticOperations;
  }[],
  fieldKey: string
) {
  return list.find(i => i.key === fieldKey);
}

// 如果不存在别名就返回 field
export function getFieldAlias(dataView: DataView, field: string) {
  if (!dataView) {
    return field ?? null;
  }
  const fields = dataView.getFields();
  if (!fields) {
    return field ?? null;
  }
  if (!fields[field]) {
    return field ?? null;
  }
  return fields[field].alias ?? field;
}

export interface IStackCacheNode {
  groupField?: string;
  values: any[];
  series: {
    s: ISeries;
    values: any[];
  }[];
  sortDatums: {
    datum: any;
    index: number;
    series: ISeries;
  }[];
  nodes: {
    [key: string]: IStackCacheNode;
  };
  key: string;
  total?: number;
}
export interface IStackCacheRoot {
  groupField?: string;
  total?: number;
  nodes: {
    [key: string]: IStackCacheNode;
  };
}

export interface IStackSortCache {
  [key: string]: {
    lastIndex: number;
    sort: { [key: string]: number };
  };
}

export function getRegionStackGroup(region: IRegion, setInitialValue: boolean, filter?: (s: any) => boolean) {
  const stackSort = region.getStackSort();

  const stackValueGroup: { [key: string]: IStackCacheRoot } = {};
  // 堆积排序 {维度key: { lastIndex: 0, sort:{[值]: 值序号}}}
  let stackSortCache: IStackSortCache = null;
  // 如果有排序
  if (stackSort) {
    // 先遍历系列，得到基于 seriesField 的排序信息
    // 这里性能消耗应该很小
    stackSortCache = {};
    region.getSeries().forEach(s => {
      // 拿到系列的 seriesField 做排序准备
      const seriesField = s.getSeriesField();
      if (seriesField) {
        const fieldInfo = s.getRawDataStatisticsByField(seriesField);
        if (fieldInfo.values) {
          if (!stackSortCache[seriesField]) {
            stackSortCache[seriesField] = { lastIndex: 0, sort: {} };
          }
          fieldInfo.values.forEach((v, i) => {
            if (!(v in stackSortCache[seriesField].sort)) {
              stackSortCache[seriesField].sort[v] = stackSortCache[seriesField].lastIndex;
              stackSortCache[seriesField].lastIndex++;
            }
          });
        }
      }
    });
  }

  region.getSeries().forEach(s => {
    const stackData = s.getStackData();
    const stackValue = s.getStackValue();
    const stackValueField = s.getStackValueField();
    const filterEnable = filter ? filter(s) : true;
    if (stackData && stackValueField && filterEnable) {
      stackValueGroup[stackValue] = stackValueGroup[stackValue] ?? {
        groupField: stackData.groupField,
        nodes: {}
      };

      stackGroup(
        s,
        stackData,
        stackValueGroup[stackValue] as IStackCacheNode,
        stackValueField,
        setInitialValue,
        stackSortCache
      );
    }
  });
  return stackSort
    ? sortStackValueGroup(stackValueGroup as { [key: string]: IStackCacheNode }, stackSortCache)
    : stackValueGroup;
}

// 排序
export function sortStackValueGroup(
  stackValueGroup: { [key: string]: IStackCacheNode },
  stackSortCache: IStackSortCache
) {
  for (const key in stackValueGroup) {
    if (stackValueGroup[key].sortDatums?.length) {
      stackValueGroup[key].sortDatums.sort((a, b) => a.index - b.index);
      stackValueGroup[key].values = stackValueGroup[key].sortDatums.map(sd => sd.datum);
    } else {
      sortStackValueGroup(stackValueGroup[key].nodes, stackSortCache);
    }
  }
  return stackValueGroup;
}

export function stackTotal(stackData: IStackCacheNode, valueField: string) {
  if ('values' in stackData && stackData.values.length) {
    const total = sum(stackData.values, valueField);
    const percent = max(stackData.values, STACK_FIELD_END_PERCENT);

    stackData.values.forEach(v => {
      v[STACK_FIELD_TOTAL] = total;
      v[STACK_FIELD_TOTAL_PERCENT] = percent;
    });

    return;
  }
  for (const key in stackData.nodes) {
    stackTotal(stackData.nodes[key], valueField);
  }
  return;
}

export interface IMosaicData {
  groupField?: string;
  groupValue?: string;
  value?: number;
  end?: number;
  start?: number;
  startPercent?: number;
  endPercent?: number;
}

export function stackMosaicTotal(stackData: IStackCacheNode, valueField: string) {
  if ('values' in stackData && stackData.values.length) {
    if (isValid(stackData.values[0]?.[STACK_FIELD_TOTAL])) {
      stackData.total = stackData.values[0]?.[STACK_FIELD_TOTAL];
    } else {
      stackData.total = sum(stackData.values, valueField);
    }
    return;
  }
  for (const key in stackData.nodes) {
    stackMosaicTotal(stackData.nodes[key], valueField);
  }

  if (stackData.nodes) {
    stackData.total = sum(
      Object.keys(stackData.nodes).map(key => stackData.nodes[key]),
      'total'
    );
  }

  return;
}

export function stackMosaic(s: ISeries, stackCache: IStackCacheNode, mosaicData?: IMosaicData[]) {
  if (stackCache.groupField && stackCache.nodes) {
    const groupValues = s.getRawDataStatisticsByField(stackCache.groupField, false)?.values || [];
    const mosaicStackData = {
      key: `${stackCache.groupField}`,
      values: groupValues.map(group => {
        const groupValues = stackCache.nodes[group];
        let value;
        if ((s as MosaicSeries).bandWidthField) {
          value =
            groupValues.values.find(v => isValid(v[(s as MosaicSeries).bandWidthField]))?.[
              (s as MosaicSeries).bandWidthField
            ] ?? groupValues.total;
        } else {
          value = groupValues.total;
        }

        return {
          groupValue: group,
          value,
          end: value
        };
      })
    };

    stack(mosaicStackData as IStackCacheNode, false, true, false, {
      key: 'groupField',
      start: 'start',
      end: 'end',
      startPercent: 'startPercent',
      endPercent: 'endPercent'
    });

    mosaicStackData.values.forEach(stackValue => {
      (stackCache.nodes[stackValue.groupValue] as any).mosaicData = stackValue;
    });
  } else if ('values' in stackCache && stackCache.values.length && mosaicData && mosaicData.length) {
    const len = mosaicData.length;
    let catStartPercent = 0;
    let catEndPercent = 1;
    let valueStartPercent = 0;
    let valueEndPercent = 1;

    for (let i = 0; i < len; i++) {
      if (i % 2 === 0) {
        const catDelta = catEndPercent - catStartPercent;

        catEndPercent = catStartPercent + mosaicData[i].endPercent * catDelta;
        catStartPercent = catStartPercent + mosaicData[i].startPercent * catDelta;
      } else {
        const valueDelta = valueEndPercent - valueStartPercent;

        valueEndPercent = valueStartPercent + mosaicData[i].endPercent * valueDelta;
        valueStartPercent = valueStartPercent + mosaicData[i].startPercent * valueDelta;
      }
    }

    if (len % 2 === 0) {
      stackCache.values.forEach(v => {
        const delta = catEndPercent - catStartPercent;
        v[MOSAIC_CAT_END_PERCENT] = catStartPercent + delta * v[STACK_FIELD_END_PERCENT];
        v[MOSAIC_CAT_START_PERCENT] = catStartPercent + delta * v[STACK_FIELD_START_PERCENT];
        v[MOSAIC_VALUE_END_PERCENT] = valueEndPercent;
        v[MOSAIC_VALUE_START_PERCENT] = valueStartPercent;
      });
    } else {
      stackCache.values.forEach(v => {
        const delta = valueEndPercent - valueStartPercent;
        v[MOSAIC_VALUE_END_PERCENT] = valueStartPercent + delta * v[STACK_FIELD_END_PERCENT];
        v[MOSAIC_VALUE_START_PERCENT] = valueStartPercent + delta * v[STACK_FIELD_START_PERCENT];
        v[MOSAIC_CAT_END_PERCENT] = catEndPercent;
        v[MOSAIC_CAT_START_PERCENT] = catStartPercent;
      });
    }
  }

  for (const key in stackCache.nodes) {
    stackMosaic(
      s,
      stackCache.nodes[key],
      (stackCache.nodes[key] as any).mosaicData
        ? mosaicData
          ? [...mosaicData, (stackCache.nodes[key] as any).mosaicData]
          : [(stackCache.nodes[key] as any).mosaicData]
        : null
    );
  }
}

export function stackOffsetSilhouette(stackCache: IStackCacheNode) {
  if (!stackCache.values.length) {
    return;
  }
  const centerValue = stackCache.values[stackCache.values.length - 1][STACK_FIELD_END] / 2;
  for (let j = 0; j < stackCache.values.length; j++) {
    stackCache.values[j][STACK_FIELD_START_OffsetSilhouette] = stackCache.values[j][STACK_FIELD_START] - centerValue;
    stackCache.values[j][STACK_FIELD_END_OffsetSilhouette] = stackCache.values[j][STACK_FIELD_END] - centerValue;
  }
}

export function stack(
  stackCache: IStackCacheNode,
  stackInverse: boolean,
  hasPercent?: boolean,
  hasMinMax?: boolean,
  fields: {
    key: string;
    start: string;
    end: string;
    startPercent: string;
    endPercent: string;
    min?: string;
    max?: string;
  } = {
    key: STACK_FIELD_KEY,
    start: STACK_FIELD_START,
    end: STACK_FIELD_END,
    startPercent: STACK_FIELD_START_PERCENT,
    endPercent: STACK_FIELD_END_PERCENT,
    max: STACK_FIELD_TOTAL_TOP,
    min: STACK_FIELD_TOTAL_BOTTOM
  }
) {
  const hasMinField = hasMinMax && isValid(fields.min);
  const hasMaxField = hasMinMax && isValid(fields.max);

  if (stackCache.values.length > 0) {
    // 设置一个小数以保证 log 计算不会报错
    let positiveStart = 0;
    let negativeStart = 0;
    // temp
    let sign = 1;
    let value = 0;
    let minNode: any = null;
    let maxNode: any = null;

    // stack
    const maxLength = stackCache.values.length;
    for (let index = 0; index < maxLength; index++) {
      const v = stackCache.values[stackInverse ? maxLength - 1 - index : index];
      value = v[fields.end];
      if (value >= 0) {
        v[fields.start] = positiveStart;
        positiveStart += v[fields.end];
        v[fields.end] = positiveStart;
      } else {
        v[fields.start] = negativeStart;
        negativeStart += v[fields.end];
        v[fields.end] = negativeStart;
      }
      v[fields.key] = stackCache.key;

      if (hasMaxField) {
        delete v[fields.max];
        if (!maxNode || v[fields.end] > maxNode[fields.end]) {
          maxNode = v;
        }
      }
      if (hasMinField) {
        delete v[fields.min];
        if (!minNode || v[fields.start] < minNode[fields.start]) {
          minNode = v;
        }
      }
    }

    hasMaxField && maxNode && (maxNode[fields.max] = true);
    hasMinField && minNode && (minNode[fields.min] = true);

    if (hasPercent) {
      // normalize
      for (let index = 0; index < maxLength; index++) {
        const v = stackCache.values[stackInverse ? maxLength - 1 - index : index];
        value = v[fields.end];
        const denominator = value >= 0 ? positiveStart : negativeStart;
        sign = value >= 0 ? 1 : -1;
        v[fields.startPercent] = denominator === 0 ? 0 : Math.min(1, v[fields.start] / denominator) * sign;
        v[fields.endPercent] = denominator === 0 ? 0 : Math.min(1, v[fields.end] / denominator) * sign;
      }
    }
  }

  for (const key in stackCache.nodes) {
    stack(stackCache.nodes[key], stackInverse, hasPercent, hasMinMax, fields);
  }
}

export function stackGroup(
  s: ISeries,
  stackData: ISeriesStackDataMeta,
  stackCache: IStackCacheNode,
  valueField: string,
  setInitialValue: boolean,
  stackSortCache: IStackSortCache,
  stackKey?: string
) {
  if ('values' in stackData) {
    setInitialValue && stackData.values.forEach(v => (v[STACK_FIELD_END] = toValidNumber(v[valueField])));
    stackCache.series.push({ s: s, values: stackData.values });
    // 如果有排序
    if (stackSortCache) {
      // 系列的 seriesField
      const seriesField = s.getSeriesField();
      stackData.values.forEach(d => {
        stackCache.sortDatums.push({
          series: s,
          datum: d,
          index: seriesField ? stackSortCache[seriesField].sort[d[seriesField]] : 0
        });
      });
    } else {
      // 如果没有排序，直接生成 values 数组
      stackCache.values.push(...stackData.values);
    }
    return;
  }
  for (const key in stackData.nodes) {
    const newStackKey = stackKey ? `${stackKey}_${key}` : key;

    if (!stackCache.nodes[key]) {
      stackCache.nodes[key] = {
        values: [],
        series: [],
        nodes: {},
        sortDatums: [],
        key: newStackKey
      };

      if (isValid(stackData.nodes[key]?.groupField)) {
        stackCache.nodes[key].groupField = stackData.nodes[key].groupField;
      }
    }

    stackGroup(
      s,
      stackData.nodes[key],
      stackCache.nodes[key],
      valueField,
      setInitialValue,
      stackSortCache,
      newStackKey
    );
  }
}
