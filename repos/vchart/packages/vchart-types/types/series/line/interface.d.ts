import type { IMarkSpec } from '../../typings/spec/common';
import type { ICartesianSeriesSpec } from '../cartesian/interface';
import type { ISymbolMarkSpec, ILineMarkSpec } from '../../typings/visual';
import type { IAnimationSpec } from '../../animation/spec';
import type { IDataSamping, IMarkOverlap, IMarkProgressiveConfig } from '../../mark/interface';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { IMultiLabelSpec, ILabelSpec } from '../../component/label/interface';
import type { ILineLikeLabelSpec, ILineLikeSeriesTheme } from '../mixin/interface';
import type { DirectionType } from '../../typings/space';
export interface ILineAnimationParams {
    direction: DirectionType;
}
export type LineAppearPreset = 'clipIn' | 'fadeIn' | 'grow';
type LineMarks = 'point' | 'line';
export interface ILineSeriesSpec extends ICartesianSeriesSpec, IAnimationSpec<LineMarks, LineAppearPreset>, IMarkProgressiveConfig, IDataSamping, IMarkOverlap {
    type: 'line';
    xField?: string | string[];
    yField?: string | string[];
    [SeriesMarkNameEnum.point]?: IMarkSpec<ISymbolMarkSpec>;
    [SeriesMarkNameEnum.line]?: IMarkSpec<ILineMarkSpec>;
    [SeriesMarkNameEnum.label]?: IMultiLabelSpec<ILineLikeLabelSpec>;
    [SeriesMarkNameEnum.lineLabel]?: Omit<ILabelSpec, 'position'> & {
        position?: 'start' | 'end';
    };
    seriesMark?: 'line' | 'point';
    activePoint?: boolean;
}
export type ILineSeriesTheme = ILineLikeSeriesTheme;
export {};
