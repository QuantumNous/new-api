import type { AxisBreakProps, AxisItem, AxisItemStateStyle } from '@visactor/vrender-components';
import type { IAnimationSpec } from '../../../animation/spec';
import type { Datum, IFormatMethod, IPadding, IRectMarkSpec, IRichTextFormatMethod, IRuleMarkSpec, ISymbolMarkSpec, ITextMarkSpec, StringOrNumber } from '../../../typings';
import type { IComponentSpec } from '../../base/interface';
import type { AxisType, IAxisItem, IBandAxisLayer, ITickCalculationCfg, StyleCallback } from './common';
import type { IBaseScale } from '@visactor/vscale';
import type { IVChart } from '../../../core';
export interface ICommonAxisSpec extends Omit<IComponentSpec, 'orient' | 'center'>, IAnimationSpec<string, string> {
    type?: AxisType;
    visible?: boolean;
    inverse?: boolean;
    tick?: ITick;
    subTick?: ISubTick;
    animation?: boolean;
    select?: boolean;
    hover?: boolean;
    sampling?: boolean;
    forceInitTick?: boolean;
}
export type ILinearAxisBreakSpec = Omit<AxisBreakProps, 'rawRange'> & {
    gap?: number | string;
    scopeType?: 'count' | 'length';
};
export interface ILinearAxisSpec {
    min?: number;
    max?: number;
    softMin?: number | ((domain: number[]) => number);
    softMax?: number | ((domain: number[]) => number);
    range?: {
        min?: number;
        max?: number;
    };
    nice?: boolean;
    niceType?: 'tickCountFirst' | 'accurateFirst';
    zero?: boolean;
    expand?: {
        min?: number;
        max?: number;
    };
    tooltipFilterRange?: number | [number, number] | ((params: {
        scale: IBaseScale;
    }) => number | [number, number]);
    breaks?: ILinearAxisBreakSpec[];
}
export interface IBandAxisSpec {
    trimPadding?: boolean;
    bandPadding?: number | number[];
    paddingInner?: number | number[];
    paddingOuter?: number | number[];
    domain?: StringOrNumber[];
    bandPosition?: number;
    showAllGroupLayers?: boolean;
    layers?: IBandAxisLayer[];
}
export interface IGrid extends IAxisItem<IRuleMarkSpec> {
    alternateColor?: string | string[];
    alignWithLabel?: boolean;
    style?: IRuleMarkSpec | StyleCallback<IRuleMarkSpec | undefined>;
    zIndex?: number;
}
export interface ITick extends IAxisItem<IRuleMarkSpec>, ITickCalculationCfg {
    tickSize?: number;
    inside?: boolean;
    alignWithLabel?: boolean;
    style?: IRuleMarkSpec | StyleCallback<IRuleMarkSpec | undefined>;
    state?: AxisItemStateStyle<IRuleMarkSpec>;
    dataFilter?: (data: AxisItem[], context: {
        vchart: IVChart;
    }) => AxisItem[];
}
export interface ISubTick extends IAxisItem<IRuleMarkSpec> {
    tickCount?: number;
    inside?: boolean;
    tickSize?: number;
    state?: AxisItemStateStyle<IRuleMarkSpec>;
}
export interface ILabel extends IAxisItem<ITextMarkSpec> {
    type?: 'text' | 'rich';
    formatMethod?: IFormatMethod<[text: string | string[], datum?: Datum]>;
    formatter?: string | string[];
    space?: number;
    inside?: boolean;
    minGap?: number;
    style?: ITextMarkSpec | StyleCallback<ITextMarkSpec | undefined>;
    state?: AxisItemStateStyle<ITextMarkSpec>;
    dataFilter?: (data: AxisItem[], layer: number, context: {
        vchart: IVChart;
    }) => AxisItem[];
}
export interface IDomainLine extends IAxisItem<IRuleMarkSpec> {
    state?: AxisItemStateStyle<IRuleMarkSpec>;
}
export interface ITitle extends IAxisItem<ITextMarkSpec> {
    type?: 'text' | 'rich';
    text?: ITextMarkSpec['text'] | ReturnType<IRichTextFormatMethod<[]>>;
    position?: 'start' | 'middle' | 'end';
    space?: number;
    padding?: IPadding | number | number[];
    background?: IAxisItem<IRectMarkSpec> & {
        state?: AxisItemStateStyle<Partial<IRectMarkSpec>>;
    };
    shape?: IAxisItem<ISymbolMarkSpec> & {
        space?: number;
        state?: AxisItemStateStyle<Partial<ISymbolMarkSpec>>;
    };
    angle?: number;
    state?: AxisItemStateStyle<Partial<ITextMarkSpec>>;
}
