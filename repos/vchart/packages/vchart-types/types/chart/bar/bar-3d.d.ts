import { BarChart } from './bar';
export declare class Bar3dChart extends BarChart {
    static readonly type: string;
    static readonly view: string;
    readonly type: string;
    readonly seriesType: string;
    protected _getDefaultSeriesSpec(spec: any): any;
}
export declare const registerBar3dChart: () => void;
