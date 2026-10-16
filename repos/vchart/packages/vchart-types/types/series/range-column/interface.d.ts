import type { IBarSeriesSpec } from '../bar/interface';
import type { ICartesianSeriesTheme } from '../cartesian/interface';
import type { IFormatMethod, IMarkSpec, IMarkTheme } from '../../typings/spec/common';
import type { IPositionedTextMarkSpec, IRectMarkSpec, ITextMarkSpec } from '../../typings/visual';
import type { IAnimationSpec } from '../../animation/spec';
import type { ILabelSpec } from '../../component/label/interface';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { DirectionType } from '../../typings/space';
export interface IRangeColumnAnimationParams {
    direction: DirectionType;
}
export type RangeColumnAppearPreset = 'fadeIn' | 'grow';
export declare const enum PositionEnum {
    middle = "middle",
    start = "start",
    end = "end",
    bothEnd = "bothEnd"
}
export declare const enum minMaxPositionEnum {
    middle = "middle",
    start = "start",
    end = "end"
}
type RangeColumnMarks = 'rangeColumn';
export interface IRangeColumnSeriesSpec extends Omit<IBarSeriesSpec, 'type' | 'label' | keyof IAnimationSpec<RangeColumnMarks, RangeColumnAppearPreset>>, IAnimationSpec<RangeColumnMarks, RangeColumnAppearPreset> {
    type: 'rangeColumn';
    minField: string;
    maxField: string;
    [SeriesMarkNameEnum.bar]?: IMarkSpec<IRectMarkSpec>;
    [SeriesMarkNameEnum.label]?: Partial<ILabelSpec> & {
        position?: PositionEnum;
        [SeriesMarkNameEnum.minLabel]?: IMarkSpec<IPositionedTextMarkSpec> & {
            visible?: boolean;
            position?: keyof typeof minMaxPositionEnum;
            offset?: number;
            formatMethod?: IFormatMethod<[text: string | string[], datum?: any]>;
        };
        [SeriesMarkNameEnum.maxLabel]?: IMarkSpec<IPositionedTextMarkSpec> & {
            visible?: boolean;
            position?: minMaxPositionEnum;
            offset?: number;
            formatMethod?: IFormatMethod<[text: string | string[], datum?: any]>;
        };
    };
}
export interface IRangeColumnSeriesTheme extends ICartesianSeriesTheme {
    [SeriesMarkNameEnum.bar]?: Partial<IMarkTheme<IRectMarkSpec>>;
    [SeriesMarkNameEnum.label]?: Partial<ILabelSpec> & {
        [SeriesMarkNameEnum.minLabel]?: Partial<IMarkTheme<ITextMarkSpec> & {
            position?: keyof typeof minMaxPositionEnum;
        }>;
        [SeriesMarkNameEnum.maxLabel]?: Partial<IMarkTheme<ITextMarkSpec> & {
            position?: keyof typeof minMaxPositionEnum;
        }>;
    };
}
export {};
