import { BaseSeriesSpecTransformer } from '../../base';
import type { ICircularProgressSeriesSpec, ICircularProgressSeriesTheme } from './interface';
export declare class CircularProgressSeriesSpecTransformer<T extends ICircularProgressSeriesSpec = ICircularProgressSeriesSpec, K extends ICircularProgressSeriesTheme = ICircularProgressSeriesTheme> extends BaseSeriesSpecTransformer<T, K> {
    protected _supportStack: boolean;
}
