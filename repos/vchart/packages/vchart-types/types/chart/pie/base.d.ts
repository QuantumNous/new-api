import { PolarChart } from '../polar/polar';
export declare class BasePieChart extends PolarChart {
    protected needAxes(): boolean;
    protected _getDefaultSeriesSpec(spec: any): any;
}
