import type { ICartesianSeriesSpec, ICartesianSeriesTheme } from '../cartesian/interface';
import type { IMarkSpec, IMarkTheme } from '../../typings/spec/common';
import type { IRectMarkSpec } from '../../typings/visual';
import type { IAnimationSpec } from '../../animation/spec';
import type { ILabelSpec, IMultiLabelSpec } from '../../component/label/interface';
import type { IDataSamping, IMarkProgressiveConfig } from '../../mark/interface';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { Functional } from '@visactor/vrender-components';
import type { IRectGraphicAttribute } from '@visactor/vrender-core';
import type { Datum, DirectionType } from '../../typings';
import type { ISeriesMarkAttributeContext } from '../../compile/mark/interface';
type BarMarks = 'bar';
export interface IBarAnimationParams {
    xField: string;
    yField: string;
    direction: DirectionType;
    growFrom: () => number;
}
export type BarAppearPreset = 'grow' | 'fadeIn' | 'scaleIn';
export type IStackCornerRadiusCallback = (attr: IRectGraphicAttribute, datum: Datum, ctx: ISeriesMarkAttributeContext) => number | number[];
export interface IBarSeriesSpec extends ICartesianSeriesSpec, IAnimationSpec<BarMarks, BarAppearPreset>, IMarkProgressiveConfig, IDataSamping {
    type: 'bar';
    xField?: string | string[];
    yField?: string | string[];
    [SeriesMarkNameEnum.bar]?: IMarkSpec<IRectMarkSpec>;
    [SeriesMarkNameEnum.barBackground]?: IMarkSpec<IRectMarkSpec> & IBarBackgroundSpec;
    [SeriesMarkNameEnum.label]?: IMultiLabelSpec<Omit<ILabelSpec, 'position'> & {
        position?: Functional<'outside' | 'top' | 'bottom' | 'left' | 'right' | 'inside' | 'inside-top' | 'inside-bottom' | 'inside-right' | 'inside-left' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'>;
    }>;
    barWidth?: number | string;
    barMinWidth?: number | string;
    barMaxWidth?: number | string;
    barGapInGroup?: number | string | (number | string)[];
    barMinHeight?: number;
    stackCornerRadius?: number | number[] | IStackCornerRadiusCallback;
    barGap?: number;
}
export interface IBarBackgroundSpec {
    fieldLevel?: number;
}
export interface IBarSeriesTheme extends ICartesianSeriesTheme {
    [SeriesMarkNameEnum.bar]?: Partial<IMarkTheme<IRectMarkSpec>>;
    [SeriesMarkNameEnum.barBackground]?: Partial<IMarkTheme<IRectMarkSpec>> & IBarBackgroundSpec;
    barWidth?: number;
    barMinWidth?: number;
    barMaxWidth?: number;
}
export {};
