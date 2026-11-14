import { CartesianChartSpecTransformer } from '../../cartesian';
import type { IRangeColumn3dChartSpec } from '../interface';
export declare class RangeColumn3dChartSpecTransformer<T extends IRangeColumn3dChartSpec = IRangeColumn3dChartSpec> extends CartesianChartSpecTransformer<T> {
    protected _getDefaultSeriesSpec(spec: any): any;
}
