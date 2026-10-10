import type { ISeriesSpec } from '../../typings';
import { BaseSeriesSpecTransformer } from '../base';
export declare class LineLikeSeriesSpecTransformer<T extends ISeriesSpec, K> extends BaseSeriesSpecTransformer<T, K> {
    protected _transformLabelSpec(spec: any): void;
}
