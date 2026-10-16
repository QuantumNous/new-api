import { BaseSeriesSpecTransformer } from '../base';
import type { ISankeySeriesSpec, ISankeySeriesTheme } from './interface';
export declare class SankeySeriesSpecTransformer<T extends ISankeySeriesSpec = ISankeySeriesSpec, K extends ISankeySeriesTheme = ISankeySeriesTheme> extends BaseSeriesSpecTransformer<T, K> {
    protected _transformLabelSpec(spec: T): void;
}
