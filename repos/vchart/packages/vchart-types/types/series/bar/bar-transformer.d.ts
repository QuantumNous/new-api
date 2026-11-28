import { BaseSeriesSpecTransformer } from '../base';
import type { IBarSeriesSpec, IBarSeriesTheme } from './interface';
export declare class BarSeriesSpecTransformer<T extends IBarSeriesSpec = IBarSeriesSpec, K extends IBarSeriesTheme = IBarSeriesTheme> extends BaseSeriesSpecTransformer<T, K> {
    protected _supportStack: boolean;
    protected _transformLabelSpec(spec: T): void;
}
