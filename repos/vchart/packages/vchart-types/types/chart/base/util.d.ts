import type { IModelSpecInfo } from '../../model/interface';
import type { RegionSpec, IRegionSpecInfo } from '../../region/interface';
import type { IChartSpecInfo } from '../interface';
import type { ISeriesSpecInfo } from '../../series/interface';
import type { ISeriesSpec } from '../../typings';
export declare const getRelatedRegionInfo: (modelInfo: IModelSpecInfo, currentChartSpecInfo: IChartSpecInfo) => Array<IRegionSpecInfo<RegionSpec>> | undefined;
export declare const getRelatedSeriesInfo: (modelInfo: IModelSpecInfo, currentChartSpecInfo: IChartSpecInfo) => Array<ISeriesSpecInfo<ISeriesSpec>> | undefined;
