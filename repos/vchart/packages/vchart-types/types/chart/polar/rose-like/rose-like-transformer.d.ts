import type { IPolarChartSpec } from '../interface';
import { PolarChartSpecTransformer } from '../polar-transformer';
export declare class RoseLikeChartSpecTransformer<T extends IPolarChartSpec> extends PolarChartSpecTransformer<T> {
    protected needAxes(): boolean;
    protected _getDefaultSeriesSpec(spec: any): any;
    transformSpec(spec: T): void;
}
