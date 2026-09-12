import type { IRangeColumn3dSeriesSpec, IRangeColumnSeriesTheme } from '../interface';
import { RangeColumnSeriesSpecTransformer } from '../range-column-transformer';
export declare class RangeColumn3dSeriesSpecTransformer<T extends IRangeColumn3dSeriesSpec = IRangeColumn3dSeriesSpec, K extends IRangeColumnSeriesTheme = IRangeColumnSeriesTheme> extends RangeColumnSeriesSpecTransformer<any, K> {
    protected _transformLabelSpec(spec: T): void;
}
