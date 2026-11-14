import type { IPolarAxisSpec } from '../../../component';
import type { IPolarChartSpec } from '../interface';
import { PolarChartSpecTransformer } from '../polar-transformer';
export declare class ProgressLikeChartSpecTransformer<T extends IPolarChartSpec> extends PolarChartSpecTransformer<T> {
    protected needAxes(): boolean;
    protected _getDefaultSeriesSpec(spec: any): any;
    protected _transformProgressAxisSpec(spec: T, angleAxisDefaultSpec: IPolarAxisSpec, radiusAxisDefaultSpec: IPolarAxisSpec, angleAxisAppendSpec?: Partial<IPolarAxisSpec>, radiusAxisAppendSpec?: Partial<IPolarAxisSpec>): void;
}
