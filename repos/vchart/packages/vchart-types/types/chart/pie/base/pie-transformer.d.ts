import type { AdaptiveSpec } from '../../../typings';
import { PolarChartSpecTransformer } from '../../polar';
import type { IPieChartSpec } from '../interface';
export declare class BasePieChartSpecTransformer<T extends IPieChartSpec> extends PolarChartSpecTransformer<AdaptiveSpec<T, 'axes'>> {
    protected needAxes(): boolean;
    protected _getDefaultSeriesSpec(spec: any): any;
}
