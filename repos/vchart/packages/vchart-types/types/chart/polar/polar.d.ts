import type { IIndicatorSpec } from '../../component/indicator/interface';
import { BaseChart } from '../base-chart';
export declare class PolarChart extends BaseChart {
    readonly seriesType: string;
    protected isValidSeries(type: string): boolean;
    protected _getDefaultSeriesSpec(spec: any): any;
    protected getIndicatorSpec(spec: any): IIndicatorSpec[];
    transformSpec(spec: any): void;
}
