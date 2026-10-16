import { BaseSeriesSpecTransformer } from '../base';
import type { IGaugePointerSeriesSpec, IGaugePointerSeriesTheme } from './interface';
export declare class GaugePointerSeriesSpecTransformer<T extends IGaugePointerSeriesSpec = IGaugePointerSeriesSpec, K extends IGaugePointerSeriesTheme = IGaugePointerSeriesTheme> extends BaseSeriesSpecTransformer<T, K> {
    protected _supportStack: boolean;
}
