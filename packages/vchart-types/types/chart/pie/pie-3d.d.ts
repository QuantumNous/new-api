import { BasePieChart } from './base';
export declare class Pie3dChart extends BasePieChart {
    static readonly type: string;
    static readonly view: string;
    readonly type: string;
    readonly seriesType: string;
    transformSpec(spec: any): void;
}
export declare const registerPie3dChart: () => void;
