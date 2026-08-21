import type { AdaptiveSpec } from '../../../typings';
import { BaseChart } from '../../base';
import type { IPieChartSpec } from '../interface';
import { BasePieChartSpecTransformer } from './pie-transformer';
export declare class BasePieChart<T extends IPieChartSpec> extends BaseChart<AdaptiveSpec<T, 'axes'>> {
    static readonly transformerConstructor: typeof BasePieChartSpecTransformer;
    readonly transformerConstructor: typeof BasePieChartSpecTransformer;
}
