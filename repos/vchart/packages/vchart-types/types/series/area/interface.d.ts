import type { ICartesianSeriesSpec } from '../cartesian/interface';
import type { IMarkSpec, IMarkTheme } from '../../typings/spec/common';
import type { ISymbolMarkSpec, ILineMarkSpec, IAreaMarkSpec } from '../../typings/visual';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { ILineLikeLabelSpec, ILineLikeSeriesTheme } from '../mixin/interface';
import type { IAnimationSpec } from '../../animation/spec';
import type { IDataSamping, IMarkOverlap, IMarkProgressiveConfig } from '../../mark/interface';
import type { IMultiLabelSpec, ILabelSpec } from '../../component/label/interface';
import type { DirectionType } from '../../typings/space';
type AreaMarks = 'point' | 'line' | 'area';
export interface IAreaAnimationParams {
    direction: DirectionType;
}
export type AreaAppearPreset = 'clipIn' | 'fadeIn' | 'grow';
export interface IAreaSeriesSpec extends ICartesianSeriesSpec, IAnimationSpec<AreaMarks, AreaAppearPreset>, IMarkProgressiveConfig, IDataSamping, IMarkOverlap {
    type: 'area';
    xField?: string | string[];
    yField?: string | string[];
    [SeriesMarkNameEnum.point]?: IMarkSpec<ISymbolMarkSpec>;
    [SeriesMarkNameEnum.line]?: IMarkSpec<ILineMarkSpec>;
    [SeriesMarkNameEnum.area]?: IMarkSpec<IAreaMarkSpec>;
    [SeriesMarkNameEnum.label]?: IMultiLabelSpec<Omit<ILineLikeLabelSpec, 'position'> & {
        position: 'top' | 'bottom' | 'left' | 'right' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center' | 'inside-middle';
    }>;
    [SeriesMarkNameEnum.areaLabel]?: Omit<ILabelSpec, 'position'> & {
        position?: 'start' | 'end';
    };
    seriesMark?: 'point' | 'line' | 'area';
    activePoint?: boolean;
}
export interface IAreaSeriesTheme extends ILineLikeSeriesTheme {
    [SeriesMarkNameEnum.area]?: Partial<IMarkTheme<IAreaMarkSpec>>;
    [SeriesMarkNameEnum.areaLabel]?: Omit<ILabelSpec, 'position'> & {
        position?: 'start' | 'end';
    };
    seriesMark?: 'point' | 'line' | 'area';
    activePoint?: boolean;
}
export {};
