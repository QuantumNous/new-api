import { BaseChart } from '../base-chart';
export declare class CartesianChart extends BaseChart {
    readonly seriesType: string;
    protected isValidSeries(type: string): boolean;
    protected needAxes(): boolean;
    protected _getDefaultSeriesSpec(spec: any): any;
    transformSpec(spec: any): void;
}
