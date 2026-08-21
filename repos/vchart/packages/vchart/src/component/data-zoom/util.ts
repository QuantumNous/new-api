import { isArray, isValid, last } from '@visactor/vutils';
import { array, isNil } from '../../util';
import type { DataView } from '@visactor/vdataset';
import type { IBandLikeScale, IBaseScale } from '@visactor/vscale';
import { isContinuous } from '@visactor/vscale';
import type { CartesianAxis, ICartesianBandAxisSpec } from '../axis/cartesian';
export interface IDataFilterWithNewDomainOption {
  getNewDomain: () => any[];
  isContinuous: () => boolean;
  field: () => string;
}

export const lockStatisticsFilter = (
  statisticsData: any,
  op: IDataFilterWithNewDomainOption & {
    originalFields: () => Record<string, any>;
  }
) => {
  const { getNewDomain, isContinuous, field, originalFields } = op;

  const datumField = field();
  const newDomain = getNewDomain();
  if (isNil(newDomain) || isNil(datumField)) {
    return statisticsData;
  }
  const fields = originalFields();
  const realField = isArray(datumField) ? datumField[0] : datumField;

  if (
    statisticsData[realField] &&
    fields &&
    fields[realField] &&
    fields[realField].lockStatisticsByDomain &&
    !isContinuous()
  ) {
    statisticsData[realField].values = newDomain;
  }

  return statisticsData;
};

/**
 * 保证数据筛选的结果全都在坐标轴的新domain范围中，防止出现point数据因为超出domain范围而绘制在原点的情况
 */
export const dataFilterWithNewDomain = (data: Array<any>, op: IDataFilterWithNewDomainOption) => {
  const { getNewDomain, isContinuous, field } = op;
  const datumField = field();
  const newDomain = getNewDomain();
  if (isNil(newDomain) || isNil(datumField)) {
    return data;
  }
  if (newDomain.length === 0) {
    return [];
  }

  // 使用map代替indexOf查找，提升性能
  const domainMap = {};
  newDomain.forEach(d => {
    if (!domainMap[d]) {
      domainMap[d] = 1;
    }
  });

  let filter = null;
  if (isContinuous()) {
    filter = (d: any) => {
      let flag = false;
      array(datumField).every(field => {
        if (d[field] >= newDomain[0] && d[field] <= last(newDomain)) {
          flag = true;
        }
        return;
      });
      return flag;
    };
  } else {
    filter = (d: any) => {
      let flag = false;
      array(datumField).every(field => {
        // 这里d[f] + ''的原因是：数据是number类型的，但轴声明为band轴，domain会强制将number => string，所以filter的时候要将data中的number => string
        if (domainMap[d[field] + ''] || domainMap[d[field]]) {
          flag = true;
        }
        return;
      });
      return flag;
    };
  }

  return data.filter(filter);
};

export interface IDataFilterComputeDomainOption {
  input: {
    dataCollection: any[];
    stateFields: string[];
    valueFields: string[];
    isCategoryState?: boolean;
    seriesCollection: any[];
    method: 'sum'; // todo: 也许可以提供多种数据统计方法 @chensiji
  };
  output: {
    stateField: string;
    valueField: string;
  };
}

export const dataFilterComputeDomain = (data: Array<any>, op: IDataFilterComputeDomainOption) => {
  const { stateFields, valueFields, dataCollection, isCategoryState, seriesCollection } = op.input;
  const { stateField, valueField } = op.output;
  const resultObj: any = {};
  const resultKeys: any[] = [];
  const resultData: any[] = [];
  const stateValues: any[] = [];
  let hasLockDomain = false;
  let isAllLinearValue = false;
  dataCollection.forEach((dv: DataView, i) => {
    if (isNil(stateFields[i])) {
      return;
    }
    const series = seriesCollection[i];
    if (series) {
      const statistics = series.getRawDataStatisticsByField(stateFields[i]);
      if (isValid(statistics?.max) && isValid(statistics?.min)) {
        isAllLinearValue = true;
      }
    }
    // 按照用户指定的domain进行排序(这里不通过getRawDataStatistics来取是因为时机不对，此时getRawDataStatistics还没有正确结果)
    const stateFieldInfo = dv.getFields()?.[stateFields[i]];
    if (stateFieldInfo && stateFieldInfo.lockStatisticsByDomain) {
      hasLockDomain = true;
      stateFieldInfo.domain.forEach((d: any) => {
        if (isNil(resultObj[d])) {
          stateValues.push(d);
          resultObj[d] = 0;
          resultKeys.push(d);
        }
      });
    }
    dv.latestData.forEach((d: any) => {
      // 针对rangeColumn等xField为数组形式的图表，需要将xField的所有value都记录下来
      array(stateFields[i]).forEach(state => {
        if (!isNil(d[state])) {
          if (isNil(resultObj[d[state]])) {
            stateValues.push(d[state]);
            resultObj[d[state]] = 0;
            resultKeys.push(d[state]);
          }
          if (!isNil(valueFields[i])) {
            // 传进来的d[yFields[i]]可能是stringnumber
            // 传进来的d[yFields[i]]可能是普通的字符串，这时计数按1计算（其实相当于计算数据条数）
            resultObj[d[state]] += isNaN(parseFloat(d[valueFields[i]])) ? 1 : parseFloat(d[valueFields[i]]);
          }
        }
      });
    });
  });

  const sortedStateValues = hasLockDomain
    ? stateValues
    : isCategoryState === false || isAllLinearValue
    ? stateValues.sort((a, b) => a - b)
    : resultKeys;

  sortedStateValues.forEach(state => {
    const res = { [stateField]: state };

    if (valueField) {
      res[valueField] = resultObj[state];
    }

    resultData.push(res);
  });

  return resultData;
};

export const statePointToData = (state: number, scale: IBaseScale, reverse: boolean) => {
  const domain = scale.domain();

  // continuous scale: 本来可以用scale invert，但scale invert在大数据场景下性能不太好，所以这里自行计算
  if (isContinuous(scale.type)) {
    if (reverse) {
      return domain[0] + (last(domain) - domain[0]) * (1 - state);
    }
    return domain[0] + (last(domain) - domain[0]) * state;
  }

  // discete scale: 根据bandSize计算不准确, bandSize不是最新的, 导致index计算错误, 所以仍然使用invert
  let range = scale.range();
  if (reverse) {
    range = range.slice().reverse();
  }
  const posInRange: number = range[0] + (last(range) - range[0]) * state;
  return scale.invert(posInRange);
};

export const dataToStatePoint = (data: number | string, scale: IBaseScale, isHorizontal: boolean) => {
  const pos = scale.scale(data);
  let range = scale.range();

  if (!isHorizontal && isContinuous(scale.type)) {
    range = range.slice().reverse();
  }

  return Math.max(0, Math.min(1, (pos - range[0]) / (last(range) - range[0])));
};

export const isReverse = (axisComponent: CartesianAxis<any>, isHorizontal: boolean) => {
  const axis = axisComponent;
  if (!axis) {
    return false;
  }
  const axisScale = axis.getScale() as IBandLikeScale;
  return axisScale.range()[0] > axisScale.range()[1] && (!axis.getInverse() || isHorizontal);
};

export const getAxisBandSize = (axisSpec?: ICartesianBandAxisSpec) => {
  const bandSize = axisSpec?.bandSize;
  const maxBandSize = axisSpec?.maxBandSize;
  const minBandSize = axisSpec?.minBandSize;
  if (bandSize || minBandSize || maxBandSize) {
    return { bandSize, maxBandSize, minBandSize };
  }
  return undefined;
};

export const modeCheck = (statePoint: 'start' | 'end', mode: string, spec: any): any => {
  if (statePoint === 'start') {
    return (mode === 'percent' && isValid(spec.start)) || (mode === 'value' && isValid(spec.startValue));
  }
  return (mode === 'percent' && isValid(spec.end)) || (mode === 'value' && isValid(spec.endValue));
};

export const parseDomainFromState = (startValue: number | string, endValue: number | string, scale: IBaseScale) => {
  if (isContinuous(scale.type)) {
    return [Math.min(endValue as number, startValue as number), Math.max(endValue as number, startValue as number)];
  }
  const allDomain = scale.domain();
  const startIndex = allDomain.indexOf(startValue);
  const endIndex = allDomain.indexOf(endValue);
  return allDomain.slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1);
};

export const parseDomainFromStateAndValue = (
  start: number,
  startValue: number | string,
  end: number,
  endValue: number | string,
  scale: IBaseScale
) => {
  if (isContinuous(scale.type)) {
    const domain = scale.domain();
    const min = domain[0];
    const total = last(domain) - min;
    const resultStart = isValid(start) ? min + total * start : +startValue;
    const resultEnd = isValid(end) ? min + total * end : +endValue;
    return [Math.min(resultEnd, resultStart), Math.max(resultEnd, resultStart)];
  }
  const allDomain = scale.domain();
  const range = scale.range();
  const rangeSize = range[range.length - 1] - range[0];
  const startIndex = isValid(start)
    ? allDomain.indexOf(scale.invert(rangeSize * start + range[0]))
    : allDomain.indexOf(startValue);
  const endIndex = isValid(end)
    ? allDomain.indexOf(scale.invert(rangeSize * end + range[0]))
    : allDomain.indexOf(endValue);
  return allDomain.slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1);
};
