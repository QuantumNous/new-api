import { BaseChart } from '../base-chart';
export declare class BaseWordCloudChart extends BaseChart {
    readonly type: string;
    readonly seriesType: string;
    transformSpec(spec: any): void;
}
