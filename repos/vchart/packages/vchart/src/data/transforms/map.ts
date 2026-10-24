import { DEFAULT_DATA_INDEX, DEFAULT_MAP_LOOK_UP_KEY } from '../../constant/data';
import type { GeoSourceType } from '../../typings/geo';
import { isFunction } from '@visactor/vutils';

export interface IMapOpt {
  nameMap: Record<string, unknown>;
  nameProperty: string;
}

type MapFeature = {
  properties?: Record<string, unknown>;
  [key: string]: unknown;
};
type MapOption = IMapOpt | (() => IMapOpt);

export const map = (data: GeoSourceType, opt: MapOption) => {
  const options = isFunction(opt) ? opt() : opt;
  const features = (data as { features?: MapFeature[] }).features;
  if (features) {
    features.forEach((f, index: number) => {
      f[DEFAULT_DATA_INDEX] = index;
      const name = f.properties?.[options.nameProperty];
      const mappedName = options.nameMap?.[`${name}`];
      if (mappedName) {
        f[DEFAULT_MAP_LOOK_UP_KEY] = mappedName;
      } else {
        f[DEFAULT_MAP_LOOK_UP_KEY] = name;
      }
    });
  }
  return features;
};
