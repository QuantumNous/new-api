import type { IRegion, ISeriesFilter } from '../region/interface';
import type { ISeries } from '../series/interface';
export declare function eachSeries(regions: IRegion[], callback: (s: ISeries) => boolean | void, filter?: ISeriesFilter): boolean;
export declare function getSeries(regions: IRegion[], filter?: ISeriesFilter): ISeries[];
export declare const getFirstSeries: (regions: IRegion[], coordinateType?: 'cartesian' | 'polar') => ISeries;
