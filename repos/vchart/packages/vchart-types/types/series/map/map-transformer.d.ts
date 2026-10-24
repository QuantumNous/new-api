import { BaseSeriesSpecTransformer } from '../base';
import type { IMapSeriesSpec, IMapSeriesTheme } from './interface';
export declare class MapSeriesSpecTransformer<T extends IMapSeriesSpec = IMapSeriesSpec, K extends IMapSeriesTheme = IMapSeriesTheme> extends BaseSeriesSpecTransformer<T, K> {
    protected _transformLabelSpec(spec: T): void;
}
