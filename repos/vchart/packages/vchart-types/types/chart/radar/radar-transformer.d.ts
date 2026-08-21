import { RoseLikeChartSpecTransformer } from '../polar';
import type { IRoseChartSpec } from '../rose';
export declare class RadarChartSpecTransformer<T extends IRoseChartSpec = IRoseChartSpec> extends RoseLikeChartSpecTransformer<T> {
    protected _getDefaultSeriesSpec(spec: any): any;
    transformSpec(spec: T): void;
}
