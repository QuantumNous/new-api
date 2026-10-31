import { BarSeriesSpecTransformer } from '../bar/bar-transformer';
import type { IRangeColumnSeriesSpec, IRangeColumnSeriesTheme } from './interface';
export declare class RangeColumnSeriesSpecTransformer<T extends IRangeColumnSeriesSpec = IRangeColumnSeriesSpec, K extends IRangeColumnSeriesTheme = IRangeColumnSeriesTheme> extends BarSeriesSpecTransformer<any, K> {
    protected _supportStack: boolean;
    protected _transformLabelSpec(spec: T): void;
}
