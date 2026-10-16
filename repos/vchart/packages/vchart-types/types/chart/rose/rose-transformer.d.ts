import { RoseLikeChartSpecTransformer } from '../polar';
import type { IRoseChartSpec } from './interface';
export declare class RoseChartSpecTransformer<T extends IRoseChartSpec = IRoseChartSpec> extends RoseLikeChartSpecTransformer<T> {
    protected _getDefaultSeriesSpec(spec: T): any;
    transformSpec(spec: T): void;
}
