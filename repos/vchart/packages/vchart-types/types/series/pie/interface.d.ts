import type { IAnimationSpec } from '../../animation/spec';
import type { IMarkSpec, IMarkTheme } from '../../typings/spec/common';
import type { IArcMarkSpec, ITextMarkSpec, ILineMarkSpec } from '../../typings/visual';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { IPolarSeriesSpec, IPolarSeriesTheme } from '../polar/interface';
import type { ILabelSpec, IMultiLabelSpec } from '../../component/label/interface';
import type { ICustomPath2D, ILineGraphicAttribute, ITextGraphicAttribute } from '@visactor/vrender-core';
import type { ILayoutRect, IPercent } from '../../typings/layout';
import type { IPointLike } from '@visactor/vutils';
import type { AnimationStateEnum } from '../../animation/interface';
import type { Datum } from '../../typings/common';
import type { IMarkGraphic } from '../../mark/interface';
export interface IPieAnimationParams {
    growField?: 'angle' | 'radius';
    growFrom: (datum: Datum, g: IMarkGraphic, state: AnimationStateEnum) => number;
}
export type PieAppearPreset = 'growAngle' | 'growRadius' | 'fadeIn';
export type PieMarks = 'pie' | 'label' | 'labelLine';
export type IBasePieSeriesSpec = Omit<IPieSeriesSpec, 'type'> & {
    type: string;
};
export interface IPieSeriesSpec extends IPolarSeriesSpec, IAnimationSpec<PieMarks, PieAppearPreset> {
    type: 'pie';
    categoryField: string;
    valueField: string;
    centerX?: number | IPercent;
    centerY?: number | IPercent;
    centerOffset?: number;
    radius?: number;
    outerRadius?: number;
    innerRadius?: number;
    cornerRadius?: number;
    startAngle?: number;
    endAngle?: number;
    padAngle?: number;
    minAngle?: number;
    layoutRadius?: 'auto' | number | ((layoutRect: ILayoutRect, center: IPointLike) => number);
    [SeriesMarkNameEnum.pie]?: IMarkSpec<IArcMarkSpec>;
    [SeriesMarkNameEnum.label]?: IMultiLabelSpec<IArcLabelSpec>;
    emptyPlaceholder?: {
        showEmptyCircle?: boolean;
        emptyCircle?: IMarkSpec<IArcMarkSpec>;
    };
    showAllZero?: boolean;
    supportNegative?: boolean;
}
export interface IPieSeriesTheme extends IPolarSeriesTheme {
    [SeriesMarkNameEnum.pie]?: Partial<IMarkTheme<IArcMarkSpec>>;
    [SeriesMarkNameEnum.label]?: IArcLabelSpec;
    innerLabel?: IArcLabelSpec;
    outerLabel?: IArcLabelSpec;
    emptyCircle?: Partial<IMarkTheme<IArcMarkSpec>>;
}
export interface IArcLabelLineSpec extends Omit<IMarkSpec<ILineMarkSpec>, 'customShape'> {
    visible?: boolean;
    line1MinLength?: number;
    line2MinLength?: number;
    smooth?: boolean;
    customShape?: (text: ITextGraphicAttribute, attrs: Partial<ILineGraphicAttribute>, path: ICustomPath2D) => ICustomPath2D;
}
export type ArcLabelAlignType = 'arc' | 'labelLine' | 'edge';
export type ArcLabelStrategyType = 'priority' | 'vertical' | 'none';
export interface IArcLabelLayoutSpec {
    textAlign?: ArcLabelAlignType;
    align?: ArcLabelAlignType;
    strategy?: ArcLabelStrategyType;
    tangentConstraint?: boolean;
}
export type IArcLabelSpec = Omit<ILabelSpec, 'position'> & {
    position?: 'outside' | 'inside' | 'inside-center';
    showRule?: 'all' | 'max' | 'min' | 'minAndMax' | 'headAndTail';
    coverEnable?: boolean;
    rotate?: boolean;
    spaceWidth?: number;
    layoutArcGap?: number;
    centerOffset?: number;
    style?: ITextMarkSpec;
    line?: IArcLabelLineSpec;
    layout?: IArcLabelLayoutSpec;
};
