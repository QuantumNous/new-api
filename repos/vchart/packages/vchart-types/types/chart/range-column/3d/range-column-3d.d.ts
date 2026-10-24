import type { IRangeColumn3dChartSpec } from '../interface';
import { RangeColumn3dChartSpecTransformer } from './range-column-3d-transformer';
import { BaseChart } from '../../base';
export declare class RangeColumn3dChart<T extends IRangeColumn3dChartSpec = IRangeColumn3dChartSpec> extends BaseChart<T> {
    static readonly type: string;
    static readonly seriesType: string;
    static readonly transformerConstructor: typeof RangeColumn3dChartSpecTransformer;
    readonly transformerConstructor: typeof RangeColumn3dChartSpecTransformer;
    readonly type: string;
    readonly seriesType: string;
}
export declare const registerRangeColumn3dChart: () => void;
