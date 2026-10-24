import { BaseSeriesSpecTransformer } from '../base';
import type { IGaugeSeriesSpec, IGaugeSeriesTheme } from './interface';
export declare class GaugeSeriesSpecTransformer<T extends IGaugeSeriesSpec = IGaugeSeriesSpec, K extends IGaugeSeriesTheme = IGaugeSeriesTheme> extends BaseSeriesSpecTransformer<T, K> {
    protected _supportStack: boolean;
    protected _transformLabelSpec(spec: T): void;
}
