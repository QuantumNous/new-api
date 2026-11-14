import type { IPictogramSeriesSpec } from '../../series/pictogram/interface';
import { BaseChartSpecTransformer } from '../base';
import type { IPictogramChartSpec } from './interface';
export declare class PictogramChartSpecTransformer<T extends IPictogramChartSpec = IPictogramChartSpec> extends BaseChartSpecTransformer<T> {
    protected _isValidSeries(type: string): boolean;
    protected _getDefaultSeriesSpec(spec: IPictogramChartSpec): IPictogramSeriesSpec;
    transformSpec(spec: T): void;
}
