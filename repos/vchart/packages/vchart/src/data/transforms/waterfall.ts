import { isFunction, isNil, precisionAdd, precisionSub } from '@visactor/vutils';

import type { DataView } from '@visactor/vdataset';
import type {
  IWaterfallSeriesSpec,
  IWaterfallTotalCustom,
  IWaterfallTotalField
} from '../../series/waterfall/interface';
import type { Datum } from '../../typings';
import { WaterfallDefaultSeriesField } from '../../constant/waterfall';
import { warn } from '../../util/debug';
import { STACK_FIELD_TOTAL_TOP } from '../../constant/data';

type TotalInfo = {
  start: number;
  end: number;
  lastIndex: string;
  lastEnd: number;
  index: string;
  isTotal: boolean;
  positive: number;
  negative: number;
};

export interface IWaterfallOpt {
  indexField: string;
  valueField: string;
  seriesField?: string;
  startAs: string;
  endAs: string;
  total: IWaterfallSeriesSpec['total'];
  calculationMode: 'increase' | 'decrease';

  seriesFieldName: {
    total: string;
    increase: string;
    decrease: string;
  };
  stackInverse: boolean;
  groupData: () => DataView;
}

export type WaterfallOption = IWaterfallOpt | (() => IWaterfallOpt);

export const waterfall = (lastData: Array<Datum>, op: WaterfallOption) => {
  if (!lastData || lastData.length === 0) {
    return lastData;
  }
  const options = isFunction(op) ? op() : op;
  const { indexField, total: totalSpec, groupData, calculationMode } = options;
  const totalData: {
    start: number;
    end: number;
    lastIndex: string;
    lastEnd: number;
    index: string;
    isTotal: boolean;
    positive: number;
    negative: number;
  }[] = [];
  const { dimensionValues, dimensionData } = groupData().latestData as {
    dimensionValues: { [key in string]: Set<string> };
    dimensionData: { [key in string]: Datum[] };
  };
  let indexValues = Array.from(dimensionValues[indexField]);
  if (calculationMode === 'decrease') {
    indexValues = indexValues.reverse();
  }
  // 上一次的计算结果
  let temp: { start: number; end: number; lastIndex: string; positive: number; negative: number } = {
    start: 0,
    end: 0,
    positive: 0,
    negative: 0,
    lastIndex: null
  };
  indexValues.forEach((key, index) => {
    const total = {
      start: temp.end,
      end: temp.end,
      lastIndex: temp.lastIndex,
      lastEnd: temp.end,
      index: key,
      isTotal: false,
      positive: temp.end,
      negative: temp.end
    };

    const indexData = options.stackInverse === true ? dimensionData[key].reverse() : dimensionData[key];
    indexData?.forEach((d, i) => {
      if (i === indexData.length - 1) {
        d[STACK_FIELD_TOTAL_TOP] = true;
      } else {
        delete d[STACK_FIELD_TOTAL_TOP];
      }
    });
    // 1.9.5 新增能力
    // 当前 key 对应的数据中有一个总计数据，并且还有其他的分组数据时。总计的计算逻辑需要将总计值拆分
    if (indexData.length > 1) {
      const isTotalCheck = (d: Datum) => {
        if (!totalSpec || totalSpec.type === 'end') {
          if (index === indexValues.length - 1) {
            return true;
          }
        } else if (totalSpec.type === 'field' || totalSpec.type === 'custom') {
          const tag = d[totalSpec.tagField];
          return !!tag;
        }
        return false;
      };
      const isTotalTag = indexData.some(d => isTotalCheck(d));
      if (isTotalTag) {
        temp = computeTotalWithMultipleData(
          indexData,
          key,
          total,
          totalData,
          temp,
          indexValues,
          index,
          options,
          isTotalCheck
        );
        totalData.push(total);
        return;
      }
    }
    temp = computeNormalData(indexData, key, total, totalData, temp, indexValues, index, options);
    totalData.push(total);
  });
  return totalData;
};

function computeTotalWithMultipleData(
  indexData: Datum[],
  key: string,
  total: TotalInfo,
  totalData: TotalInfo[],
  temp: { start: number; end: number; lastIndex: string; positive: number; negative: number },
  indexValues: string[],
  index: number,
  op: IWaterfallOpt,
  isTotalCheck: (d: Datum) => boolean
) {
  total.isTotal = true;
  const { valueField, startAs, endAs, total: totalSpec } = op;
  // 先将数据分为总计数据与常规数据
  const _normalTemp: Datum[] = [];
  const _totalTemp: Datum[] = [];
  // 将总计数据与常规数据进行分离
  indexData.forEach((d, index) => {
    if (isTotalCheck(d)) {
      // 总计数据后续要重新按照顺序计算 start end 信息，所以需要记录下当前的 index
      _totalTemp.push({ ...d, [`_vchart_waterfall_waterfall_temp`]: index });
    } else {
      _normalTemp.push(d);
    }
  });
  // 1. 不可能全都不是总计数据
  // 2. 如果全都是总计数据，让它们都是同一个值
  if (_totalTemp.length === indexData.length) {
    const result = computeNormalData([indexData[0]], key, total, totalData, temp, indexValues, index, op);
    _totalTemp.forEach(d => {
      d[startAs] = indexData[0][startAs];
      d[endAs] = indexData[0][endAs];
      d[valueField] = indexData[0][valueField];
    });
    return result;
  }

  // 3. 其他常规情况
  // 先获取当前的起始值/结束值应当是多少
  // 按照第一个总计数据的配置来决定
  const totalConfigData = _totalTemp[0];
  // 获取配置中的总计结果
  // eslint-disable-next-line prefer-const
  let { start, end } = getTotalStartEnd(totalConfigData, total, totalData, temp, totalSpec);
  total.start = start;
  total.end = end;
  let positive = start;
  let navigate = start;
  // 当前剩余的总计值
  let valueTemp = end - start;
  const tempTotalValue = _normalTemp.reduce((pre, cur) => precisionSub(pre, +cur[valueField]), valueTemp);
  // 模拟一组临时总计数据，用来堆叠
  _totalTemp.forEach(d => {
    const tempTotalData = {
      [startAs]: start,
      [endAs]: end,
      [valueField]: tempTotalValue
    };
    // 将临时总计插入 `_vchart_waterfall_waterfall_temp_${index}` 中
    _normalTemp.splice(d._vchart_waterfall_waterfall_temp, 0, tempTotalData);
  });
  // 将全部数据进行堆叠
  _normalTemp.forEach(d => {
    const value = +d[valueField];
    if (value >= 0) {
      d[startAs] = +positive;
      positive = precisionAdd(positive, value);
    } else {
      d[startAs] = +navigate;
      navigate = precisionAdd(navigate, value);
    }
    d[endAs] = precisionAdd(d[startAs], value);
    start = precisionAdd(start, value);
    valueTemp = precisionSub(valueTemp, value);
  });
  // 设置数据中的总计数据
  _totalTemp.forEach(_d => {
    const index = _d._vchart_waterfall_waterfall_temp;
    // 数据的堆积计算结果
    _d = _normalTemp[index];
    // 原始数据
    const d = indexData[index];
    d[startAs] = _d[startAs];
    d[endAs] = _d[endAs];
    d[valueField] = _d[valueField];
  });
  return { ...total, lastIndex: key };
}

function computeNormalData(
  indexData: Datum[],
  key: string,
  total: TotalInfo,
  totalData: TotalInfo[],
  temp: { start: number; end: number; lastIndex: string; positive: number; negative: number },
  indexValues: string[],
  index: number,
  op: IWaterfallOpt
) {
  const { valueField, startAs, endAs, total: totalSpec, seriesField, seriesFieldName } = op;
  indexData.forEach(d => {
    let isTotalTag = false;
    if (!totalSpec || totalSpec.type === 'end') {
      if (index === indexValues.length - 1) {
        total.start = 0;
        d[startAs] = total.start;
        d[endAs] = total.end;
        isTotalTag = true;
      }
    } else if (totalSpec.type === 'field' || totalSpec.type === 'custom') {
      const tag = d[totalSpec.tagField];
      if (tag) {
        isTotalTag = true;
        const { start, end } = getTotalStartEnd(d, total, totalData, temp, totalSpec);
        d[startAs] = start;
        d[endAs] = end;
        d[valueField] = end - start;
        total.start = start;
        total.end = end;
      }
    }
    if (!isTotalTag) {
      const value = +d[valueField];
      // 区分正负值
      if (value >= 0) {
        d[startAs] = +total.positive;
        total.positive = precisionAdd(total.positive, value);
      } else {
        d[startAs] = +total.negative;
        total.negative = precisionAdd(total.negative, value);
      }
      d[endAs] = precisionAdd(d[startAs], value);
      total.end = precisionAdd(total.end, value);
    }
    total.isTotal = isTotalTag;

    if (isNil(seriesField) || seriesField === WaterfallDefaultSeriesField) {
      if (isTotalTag) {
        d[WaterfallDefaultSeriesField] = seriesFieldName.total;
      } else {
        d[WaterfallDefaultSeriesField] = +d[valueField] >= 0 ? seriesFieldName.increase : seriesFieldName.decrease;
      }
    }
  });
  return { ...total, lastIndex: key };
}

function getTotalStartEnd(
  d: Datum,
  total: TotalInfo,
  totalData: TotalInfo[],
  temp: { start: number; end: number; lastIndex: string; positive: number; negative: number },
  totalSpec: IWaterfallOpt['total']
) {
  if (!totalSpec || totalSpec.type === 'end') {
    return getTotalInEndType(total);
  } else if (totalSpec.type === 'field' || totalSpec.type === 'custom') {
    if (totalSpec.type === 'custom') {
      return getTotalInCustomType(d, temp, totalSpec);
    }
    // 如果有设置count， valueField 和 startField 无效
    if (totalSpec.collectCountField && !isNil(d[totalSpec.collectCountField])) {
      return getTotalInCollectField(d, totalData, total, totalSpec);
    }
    return getTotalInField(d, total, totalSpec);
  }
  return { start: 0, end: 0 };
}

function getTotalInEndType(total: TotalInfo) {
  return { start: 0, end: total.end };
}

function getTotalInCustomType(
  d: Datum,
  temp: { start: number; end: number; lastIndex: string; positive: number; negative: number },
  totalSpec: IWaterfallOpt['total']
) {
  return (<IWaterfallTotalCustom>totalSpec).product(d, temp);
}

function getTotalInCollectField(d: Datum, totalData: TotalInfo[], total: TotalInfo, totalSpec: IWaterfallTotalField) {
  let start = 0;
  let end = total.end;
  const startIndex = totalData.length - +d[totalSpec.collectCountField];
  const endIndex = totalData.length - 1;
  if (startIndex < 0) {
    warn('total.collectCountField error');
  } else {
    start = totalData[startIndex].start;
  }
  if (endIndex < 0) {
    warn('total.collectCountField error');
  } else {
    end = totalData[endIndex].end;
  }
  return { start, end };
}

function getTotalInField(d: Datum, total: TotalInfo, totalSpec: IWaterfallTotalField) {
  let start = 0;
  let end = total.end;
  if (totalSpec.startField && !isNil(d[totalSpec.startField])) {
    start = +d[totalSpec.startField];
  }
  if (totalSpec.valueField && !isNil(d[totalSpec.valueField])) {
    end = precisionAdd(start, +d[totalSpec.valueField]);
  }
  return { start, end };
}

export interface IWaterfallFillEndOpt {
  indexField: string;
  valueField: string;
  seriesField?: string;
  total: IWaterfallSeriesSpec['total'];
  calculationMode: IWaterfallSeriesSpec['calculationMode'];
}

export type WaterfallFillEndOption = IWaterfallFillEndOpt | (() => IWaterfallFillEndOpt);

export const waterfallFillTotal = (data: Array<Datum>, op: WaterfallFillEndOption) => {
  if (!data) {
    return data;
  }
  const { indexField, valueField, total, seriesField, calculationMode } = isFunction(op) ? op() : op;
  const totalData = {
    [indexField]: total?.text || 'total',
    [valueField]: data.reduce((pre, cur) => precisionAdd(pre, +cur[valueField]), 0)
  };
  if (seriesField) {
    totalData[seriesField] = 'total';
  }
  if (calculationMode === 'decrease') {
    return [totalData, ...data];
  }
  return [...data, totalData];
};
