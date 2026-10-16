import type { IBar3dSeriesSpec, IBar3dSeriesTheme } from './interface';
import { BarSeriesSpecTransformer } from './bar-transformer';
export declare class Bar3dSeriesSpecTransformer<T extends IBar3dSeriesSpec = IBar3dSeriesSpec, K extends IBar3dSeriesTheme = IBar3dSeriesTheme> extends BarSeriesSpecTransformer<T, K> {
    protected _transformLabelSpec(spec: T): void;
}
