import type { IRegion, ISeriesFilter } from '../region/interface';
import type { ISeries } from '../series/interface';
import { isFunction } from './type';

export function eachSeries(regions: IRegion[], callback: (s: ISeries) => boolean | void, filter?: ISeriesFilter) {
  let flag = false;
  if (callback && isFunction(callback)) {
    for (const r of regions) {
      for (const s of r.getSeries(filter)) {
        flag = !!callback.call(null, s);
        if (flag) {
          return flag;
        }
      }
    }
  }
  return flag;
}

export function getSeries(regions: IRegion[], filter?: ISeriesFilter) {
  const result: ISeries[] = [];
  for (const r of regions) {
    for (const s of r.getSeries(filter)) {
      result.push(s);
    }
  }
  return result;
}

export const getFirstSeries = (regions: IRegion[], coordinateType?: 'cartesian' | 'polar') => {
  for (let i = 0; i < regions.length; i++) {
    const r = regions[i];
    const series = r.getSeries();
    for (let j = 0; j < series.length; j++) {
      const s = series[j];
      if (coordinateType && s && s.coordinate === coordinateType) {
        return s;
      }
      if (!coordinateType && s) {
        return s;
      }
    }
  }
  return null;
};
