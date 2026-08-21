import { CartesianChart } from '../cartesian/cartesian';
export declare class RangeColumn3dChart extends CartesianChart {
    static readonly type: string;
    static readonly view: string;
    readonly type: string;
    readonly seriesType: string;
    protected _getDefaultSeriesSpec(spec: any): any;
}
export declare const registerRangeColumn3dChart: () => void;
