import type { IPie3dSeriesSpec, IPie3dSeriesTheme } from '../interface';
import { PieSeriesSpecTransformer } from '../pie-transformer';
export declare class Pie3dSeriesSpecTransformer<T extends IPie3dSeriesSpec = IPie3dSeriesSpec, K extends IPie3dSeriesTheme = IPie3dSeriesTheme> extends PieSeriesSpecTransformer<T, K> {
    protected _transformLabelSpec(spec: T): void;
}
