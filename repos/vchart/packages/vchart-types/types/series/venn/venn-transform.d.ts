import type { ISeriesSpec } from '../../typings';
import { BaseSeriesSpecTransformer } from '../base';
import type { IVennSeriesSpec, IVennSeriesTheme } from './interface';
export declare class VennSeriesSpecTransformer<T extends ISeriesSpec = Omit<IVennSeriesSpec, 'data'>, K extends IVennSeriesTheme = IVennSeriesTheme> extends BaseSeriesSpecTransformer<T, K> {
    protected _transformLabelSpec(spec: T): void;
}
