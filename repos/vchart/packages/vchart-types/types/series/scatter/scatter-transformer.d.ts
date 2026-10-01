import { BaseSeriesSpecTransformer } from '../base';
import type { IScatterSeriesSpec, IScatterSeriesTheme } from './interface';
export declare class ScatterSeriesSpecTransformer<T extends IScatterSeriesSpec = IScatterSeriesSpec, K extends IScatterSeriesTheme = IScatterSeriesTheme> extends BaseSeriesSpecTransformer<T, K> {
    protected _transformLabelSpec(spec: T): void;
}
