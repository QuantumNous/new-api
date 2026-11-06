import type { ISeriesSpec } from '../../typings/spec/common';
import type { DirectionType } from '../../typings';
import type { ILabelSpec } from '../../component/label/interface';
export interface ICartesianSeriesSpec extends ISeriesSpec {
    direction?: DirectionType;
    xField?: string | string[];
    x2Field?: string;
    yField?: string | string[];
    y2Field?: string;
    zField?: string | string[];
    sortDataByAxis?: boolean;
}
export interface ICartesianSeriesTheme {
    label?: Partial<ILabelSpec>;
}
