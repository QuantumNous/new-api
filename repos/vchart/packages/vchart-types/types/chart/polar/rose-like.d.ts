import { PolarChart } from './polar';
export declare class RoseLikeChart extends PolarChart {
    protected _canStack: boolean;
    protected needAxes(): boolean;
    protected _getDefaultSeriesSpec(spec: any): any;
    transformSpec(spec: any): void;
}
