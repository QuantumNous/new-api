import type { IWordCloud3dChartSpec } from './interface';
import { BaseWordCloudChart } from './base';
export declare class WordCloud3dChart extends BaseWordCloudChart {
    static readonly type: string;
    static readonly view: string;
    readonly type: string;
    readonly seriesType: string;
    protected _getDefaultSeriesSpec(spec: IWordCloud3dChartSpec): any;
}
export declare const registerWordCloud3dChart: () => void;
export declare const registerWordCloudShape3dChart: () => void;
