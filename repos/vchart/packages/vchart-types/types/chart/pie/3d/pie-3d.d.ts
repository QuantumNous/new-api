import { BasePieChart } from '../base/base';
import type { IPie3dChartSpec } from '../interface';
import type { AdaptiveSpec } from '../../../typings';
import { BasePieChartSpecTransformer } from '../base';
export declare class Pie3dChartSpecTransformer<T extends IPie3dChartSpec = IPie3dChartSpec> extends BasePieChartSpecTransformer<AdaptiveSpec<T, 'type'>> {
    transformSpec(spec: any): void;
}
export declare class Pie3dChart<T extends IPie3dChartSpec = IPie3dChartSpec> extends BasePieChart<AdaptiveSpec<T, 'type'>> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof Pie3dChartSpecTransformer;
    readonly transformerConstructor: typeof Pie3dChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
}
export declare const registerPie3dChart: () => void;
