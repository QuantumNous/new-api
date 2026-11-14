import type { ICartesianAxisSpec } from '../../component';
import { BaseChartSpecTransformer } from '../base';
import type { ICartesianChartSpec } from './interface';
export declare class CartesianChartSpecTransformer<T extends ICartesianChartSpec> extends BaseChartSpecTransformer<T> {
    protected needAxes(): boolean;
    protected _isValidSeries(type: string): boolean;
    protected _getDefaultSeriesSpec(spec: any, pickKeys?: string[]): any;
    transformSpec(spec: T): void;
    protected _setDefaultXAxisSpec(spec: T): ICartesianAxisSpec;
    protected _setDefaultYAxisSpec(spec: T): ICartesianAxisSpec;
    protected _setDefaultZAxisSpec(spec: T): ICartesianAxisSpec;
    protected _transformAxisSpec(spec: T): void;
}
