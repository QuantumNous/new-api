import type { IMapSeriesSpec } from '../../series';
import { BaseChartSpecTransformer } from '../base';
import type { IMapChartSpec } from './interface';
export declare class MapChartSpecTransformer<T extends IMapChartSpec = IMapChartSpec> extends BaseChartSpecTransformer<T> {
    protected _isValidSeries(type: string): boolean;
    protected _getDefaultSeriesSpec(spec: IMapChartSpec): IMapSeriesSpec;
    transformSpec(spec: T): void;
}
