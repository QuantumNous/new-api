import type { IPolarAxisSpec } from '../../component/axis/polar/interface';
import { PolarChart } from './polar';
export declare class ProgressLikeChart extends PolarChart {
    protected needAxes(): boolean;
    protected _getDefaultSeriesSpec(spec: any): any;
    protected _transformProgressAxisSpec(spec: any, angleAxisDefaultSpec: IPolarAxisSpec, radiusAxisDefaultSpec: IPolarAxisSpec, angleAxisAppendSpec?: Partial<IPolarAxisSpec>, radiusAxisAppendSpec?: Partial<IPolarAxisSpec>): void;
}
