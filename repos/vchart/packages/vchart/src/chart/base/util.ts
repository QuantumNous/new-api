import { array, isValid } from '@visactor/vutils';
import type { IModelSpecInfo } from '../../model/interface';
import type { RegionSpec, IRegionSpecInfo } from '../../region/interface';
import type { IChartSpecInfo } from '../interface';
import type { ISeriesSpecInfo } from '../../series/interface';
import type { ISeriesSpec } from '../../typings';
import type { IComponentSpec } from '../../component/base/interface';

/** 寻找和 model 关联的 region info */
export const getRelatedRegionInfo = (
  modelInfo: IModelSpecInfo,
  currentChartSpecInfo: IChartSpecInfo
): Array<IRegionSpecInfo<RegionSpec>> | undefined => {
  const spec = modelInfo.spec as IComponentSpec;
  const { regionId, regionIndex } = spec;
  if (isValid(regionId)) {
    const regionIdList = array(regionId);
    return currentChartSpecInfo.region?.filter(({ spec }) => regionIdList.includes(spec.id));
  } else if (isValid(regionIndex)) {
    return array(regionIndex)
      .map((index: number) => currentChartSpecInfo.region?.[index])
      .filter(isValid);
  }
  return undefined;
};

/** 寻找和 model 关联的 series info */
export const getRelatedSeriesInfo = (
  modelInfo: IModelSpecInfo,
  currentChartSpecInfo: IChartSpecInfo
): Array<ISeriesSpecInfo<ISeriesSpec>> | undefined => {
  const spec = modelInfo.spec as IComponentSpec;
  const { seriesId, seriesIndex } = spec;
  if (isValid(seriesId)) {
    const seriesIdList = array(seriesId);
    return currentChartSpecInfo.series?.filter(({ spec }) => seriesIdList.includes(spec.id));
  } else if (isValid(seriesIndex)) {
    return array(seriesIndex)
      .map((index: number) => currentChartSpecInfo.series?.[index])
      .filter(isValid);
  }
  return undefined;
};
