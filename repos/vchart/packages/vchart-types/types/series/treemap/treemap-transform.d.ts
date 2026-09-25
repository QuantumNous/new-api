import type { ISeriesSpec } from '../../typings';
import { BaseSeriesSpecTransformer } from '../base';
import type { ITreemapSeriesSpec, ITreemapSeriesTheme } from './interface';
export declare class TreemapSeriesSpecTransformer<T extends ISeriesSpec = Omit<ITreemapSeriesSpec, 'data'>, K extends ITreemapSeriesTheme = ITreemapSeriesTheme> extends BaseSeriesSpecTransformer<T, K> {
    protected _transformLabelSpec(spec: T): void;
}
