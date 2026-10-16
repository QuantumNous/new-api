import type { DataView } from '@visactor/vdataset';
import { isFunction, isNil, isValid } from '@visactor/vutils';
import type { Datum } from '../../typings';

export interface ILookUpOpt {
  from: () => object[];
  key: string;
  // 暂时不支持Multi-field lookup
  fields: string | (() => string);
  values?: string[];
  as?: string[];
  default?: unknown;
  set?: (A: Datum, B?: Datum) => void;
}

const resolveOptionValue = <T>(option: T | (() => T)) => (isFunction(option) ? option() : option);

export const lookup = (data: Array<DataView>, opt: ILookUpOpt) => {
  const fromData = opt.from?.();
  if (!fromData) {
    return data;
  }

  const fields = resolveOptionValue(opt.fields);
  const key = opt.key;
  const values = opt.values;
  const defaultValue = opt.default;
  const as = opt.as || [fields];
  const index = (fromData as Array<Record<string, unknown>>).reduce(function (
    map: Map<string, Record<string, unknown>>,
    obj
  ) {
    if (obj[fields]) {
      map.set(`${obj[fields]}`, obj);
    }
    return map;
  }, new Map<string, Record<string, unknown>>());

  let set: (d: Record<string, unknown>) => void;
  if (isFunction(opt.set)) {
    set = function (d: Record<string, unknown>) {
      const v = index.get(`${d[key]}`);
      opt.set(d as Datum, v as Datum);
    };
  } else if (values) {
    const m = values.length;
    set = function (d: Record<string, unknown>) {
      const v = index.get(`${d[key]}`);
      if (isNil(v)) {
        for (let i = 0; i < m; ++i) {
          d[as[i]] = defaultValue;
        }
      } else {
        for (let i = 0; i < m; ++i) {
          d[as[i]] = v[values[i]];
        }
      }
    };
  } else {
    set = function (d: Record<string, unknown>) {
      const v = index.get(`${d[key]}`);
      d[as[0]] = isValid(v) ? v : defaultValue;
    };
  }

  if (data.length === 0) {
    return [];
  }
  return (data as unknown as Array<Record<string, unknown>>).map(d => {
    set(d);
    return d;
  }) as unknown as Array<DataView>;
};
