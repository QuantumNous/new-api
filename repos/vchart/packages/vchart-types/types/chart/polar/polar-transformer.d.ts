import type { IIndicatorSpec } from '../../component';
import { BaseChartSpecTransformer } from '../base';
import type { IPolarChartSpec } from './interface';
export declare class PolarChartSpecTransformer<T extends IPolarChartSpec> extends BaseChartSpecTransformer<T> {
    protected _isValidSeries(type: string): boolean;
    protected getIndicatorSpec(spec: any): IIndicatorSpec[];
    protected _getDefaultSeriesSpec(spec: any, pickKeys?: string[]): any;
    transformSpec(spec: T): void;
}
