import { PolarSeries } from '../polar';
import type { IRoseLikeSeriesSpec } from './interface';
import type { ISeriesSpecUpdatePolicy } from '../../base/base-series';
export declare abstract class RoseLikeSeries<T extends IRoseLikeSeriesSpec> extends PolarSeries<T> {
    protected _getSpecUpdatePolicy(): ISeriesSpecUpdatePolicy;
    getStackGroupFields(): string[];
    getStackValueField(): string;
    getGroupFields(): string[];
    setAttrFromSpec(): void;
    setValueFieldToStack(): void;
    setValueFieldToPercent(): void;
    getDimensionField(): string[];
    getMeasureField(): string[];
    getDefaultShapeType(): string;
}
