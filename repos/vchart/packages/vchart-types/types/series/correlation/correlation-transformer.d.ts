import { BaseSeriesSpecTransformer } from '../base';
import type { ICorrelationSeriesSpec, ICorrelationSeriesTheme } from './interface';
export declare class CorrelationSeriesSpecTransformer<T extends ICorrelationSeriesSpec = ICorrelationSeriesSpec, K extends ICorrelationSeriesTheme = ICorrelationSeriesTheme> extends BaseSeriesSpecTransformer<T, K> {
    protected _transformLabelSpec(spec: T): void;
}
