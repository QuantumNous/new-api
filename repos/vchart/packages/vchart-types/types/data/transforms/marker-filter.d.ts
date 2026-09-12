import type { ICartesianSeries } from '../../series/interface/series';
export interface IMarkerFilterOptions {
    getRelativeSeries: () => ICartesianSeries;
}
export declare function markerFilter(data: Array<DataView>, options: IMarkerFilterOptions): DataView[];
