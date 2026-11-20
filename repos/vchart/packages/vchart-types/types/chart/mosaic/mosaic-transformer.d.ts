import type { ICartesianAxisSpec } from '../../component/axis/cartesian/interface/spec';
import { CartesianChartSpecTransformer } from '../cartesian';
import type { IMosaicChartSpec } from './interface';
export declare class MosaicChartSpecTransformer<T extends IMosaicChartSpec = IMosaicChartSpec> extends CartesianChartSpecTransformer<T> {
    protected _getDefaultSeriesSpec(spec: T): any;
    transformSpec(spec: T): void;
    protected _setDefaultXAxisSpec(spec: T): ICartesianAxisSpec;
    protected _setDefaultYAxisSpec(spec: T): ICartesianAxisSpec;
}
