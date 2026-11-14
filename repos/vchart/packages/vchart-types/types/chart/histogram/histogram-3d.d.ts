import { BaseHistogramChart } from './base';
export declare class Histogram3dChart extends BaseHistogramChart {
    static readonly type: string;
    static readonly view: string;
    readonly type: string;
    readonly seriesType: string;
}
export declare const registerHistogram3dChart: () => void;
