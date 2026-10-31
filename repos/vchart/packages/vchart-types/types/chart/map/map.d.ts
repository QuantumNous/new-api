import { BaseChart } from '../base/base-chart';
import type { IMapChartSpec } from './interface';
import { MapChartSpecTransformer } from './map-transformer';
export declare class MapChart<T extends IMapChartSpec = IMapChartSpec> extends BaseChart<T> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof MapChartSpecTransformer;
    readonly transformerConstructor: typeof MapChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
}
export declare const registerMapChart: () => void;
