import type { DataView } from '@visactor/vdataset';
import { isFunction, isValidNumber } from '@visactor/vutils';

type FunnelOptionValue<T> = T | (() => T);

export interface IFunnelOpt {
  valueField: FunnelOptionValue<string>;
  /** 转化率（当前层到下一层的比例） **/
  asTransformRatio: string;
  /** 到达率 （上一层到当前层的比例）*/
  asReachRatio: string;
  /** 高度轴占总量的比例 **/
  asHeightRatio: string;
  /** 当前值大小占比 */
  asValueRatio: string;
  /** 上一层值大小占比 */
  asLastValueRatio: string;
  /** 下一层值大小占比 */
  asNextValueRatio: string;
  /** 当前层的值 */
  asCurrentValue: string;
  /** 上一层的值 **/
  asLastValue: string;
  /** 下一层的值 **/
  asNextValue: string;

  /** 最底层漏斗是否为锥形 */
  isCone?: FunnelOptionValue<boolean | undefined>;
  /** 高度是否进行数据映射 **/
  heightVisual?: FunnelOptionValue<boolean | undefined>;

  /** 数值范围 */
  range?: FunnelOptionValue<{ min?: number; max?: number } | undefined>;
}

const resolveOptionValue = <T>(option: FunnelOptionValue<T>) => (isFunction(option) ? option() : option);

export const funnel = (originData: Array<DataView>, op: IFunnelOpt) => {
  const data = originData.map(datum => ({ ...datum }));
  if (!data || data.length === 0) {
    return data;
  }
  const {
    asTransformRatio,
    asReachRatio,
    asHeightRatio,
    asValueRatio,
    asNextValueRatio,
    asLastValueRatio,
    asLastValue,
    asCurrentValue,
    asNextValue,
  } = op;
  const valueField = resolveOptionValue(op.valueField);
  const heightVisual = resolveOptionValue(op.heightVisual) ?? false;
  const isCone = resolveOptionValue(op.isCone) ?? true;
  const range = resolveOptionValue(op.range);

  const max = data.reduce((m, d) => Math.max(m, Number.parseFloat(d[valueField]) || -Infinity), -Infinity);
  const min = data.reduce((m, d) => Math.min(m, Number.parseFloat(d[valueField]) || Infinity), Infinity);
  const rangeArr = [range?.min ?? min, range?.max ?? max];

  data.forEach((d, i) => {
    const currentValue: number = Number.parseFloat(d[valueField]);
    const lastValue: number = Number.parseFloat(data[i - 1]?.[valueField]);
    const nextValue: number = Number.parseFloat(data[i + 1]?.[valueField]);

    const transformRatio =
      !isValidNumber(nextValue * currentValue) || currentValue === 0 ? 0 : nextValue / currentValue;
    const reachRatio = !isValidNumber(currentValue * lastValue) || lastValue === 0 ? 0 : currentValue / lastValue;

    asLastValue && (d[asLastValue] = lastValue);
    asNextValue && (d[asNextValue] = nextValue);
    asTransformRatio && (d[asTransformRatio] = transformRatio);
    asReachRatio && (d[asReachRatio] = i === 0 ? 1 : reachRatio);
    asHeightRatio && (d[asHeightRatio] = heightVisual === true ? transformRatio : 1 / data.length);
    asValueRatio && (d[asValueRatio] = currentValue / rangeArr[1]);
    asNextValueRatio &&
      (d[asNextValueRatio] = i === data.length - 1 ? (isCone ? 0 : d[asValueRatio]) : nextValue / rangeArr[1]);
    asLastValueRatio && (d[asLastValueRatio] = i === 0 ? 1 : lastValue / rangeArr[1]);
    asCurrentValue && (d[asCurrentValue] = currentValue);
  });

  return data;
};

export interface IFunnelTransformOpt {
  asIsTransformLevel: string;
}

export const funnelTransform = (originData: Array<DataView>, op: IFunnelTransformOpt) => {
  const data: Array<Record<string, unknown>> | undefined = originData[0]?.latestData?.map(
    (datum: Record<string, unknown>) => ({ ...datum })
  );
  if (!data || data.length === 0) {
    return data;
  }
  data.shift();
  data.forEach(d => {
    d[op.asIsTransformLevel] = true;
  });
  return data;
};
