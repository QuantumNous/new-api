import type { Datum, IPadding, IPolarOrientType, IRectMarkSpec, IRuleMarkSpec, ISymbolMarkSpec, ITextMarkSpec, StringOrNumber } from '../../typings';
import type { ICartesianAxisSpec } from './cartesian/interface';
import type { IComponent } from '../interface';
import type { IBaseScale } from '@visactor/vscale';
import type { IAnimationSpec } from '../../animation/spec';
import type { AxisItem, AxisItemStateStyle } from '@visactor/vrender-components';
import type { IComponentSpec } from '../base/interface';
import type { ITextGraphicAttribute } from '@visactor/vrender-core';
export interface StatisticsDomain {
    domain: any[];
    index: {
        [key in StringOrNumber]: number;
    };
}
export interface IAxis extends IComponent {
    valueToPosition: (value: any) => number;
    getScale: () => IBaseScale;
    getScales: () => IBaseScale[];
    getOrient: () => ICartesianAxisSpec['orient'] | IPolarOrientType;
    visible: boolean;
    getStatisticsDomain: () => StatisticsDomain;
}
export interface IAxisItem<T> {
    visible?: boolean;
    style?: Omit<T, 'visible'>;
}
export interface IAxisItemTheme<T> {
    visible?: boolean;
    style?: Omit<T, 'visible'>;
}
export type AxisAnimationPreset = 'groupFadeIn' | 'fadeIn' | 'grow';
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
}
export interface ILinearAxisSpec {
    min?: number;
    max?: number;
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
    tooltipFilterRange?: number | [number, number] | ((params: { scale: IBaseScale }) => number | [number, number]);
}
export interface IBandAxisSpec {
    bandPadding?: number | number[];
    paddingInner?: number | number[];
    paddingOuter?: number | number[];
    domain?: StringOrNumber[];
    bandPosition?: number;
}
export interface IGrid extends IAxisItem<IRuleMarkSpec> {
    alternateColor?: string | string[];
    alignWithLabel?: boolean;
    style?: IRuleMarkSpec | StyleCallback<IRuleMarkSpec | undefined>;
    zIndex?: number;
}
export type ITickCallbackOption = {
    axisLength?: number;
    labelStyle?: ITextGraphicAttribute;
};
export interface ITick extends IAxisItem<IRuleMarkSpec> {
    tickSize?: number;
    inside?: boolean;
    alignWithLabel?: boolean;
    tickStep?: number;
    tickCount?: number | ((option: ITickCallbackOption) => number);
    forceTickCount?: number;
    tickMode?: 'average' | 'd3';
    noDecimals?: boolean;
    style?: IRuleMarkSpec | StyleCallback<IRuleMarkSpec | undefined>;
    state?: AxisItemStateStyle<IRuleMarkSpec>;
    dataFilter?: (data: AxisItem[]) => AxisItem[];
}
export interface ISubTick extends IAxisItem<IRuleMarkSpec> {
    tickCount?: number;
    inside?: boolean;
    tickSize?: number;
    state?: AxisItemStateStyle<IRuleMarkSpec>;
}
export interface ILabel extends IAxisItem<ITextMarkSpec> {
    formatMethod?: (text: string | string[], datum?: Datum) => string | string[];
    space?: number;
    inside?: boolean;
    minGap?: number;
    style?: ITextMarkSpec | StyleCallback<ITextMarkSpec | undefined>;
    state?: AxisItemStateStyle<ITextMarkSpec>;
    dataFilter?: (data: AxisItem[], layer: number) => AxisItem[];
}
export interface IDomainLine extends IAxisItem<IRuleMarkSpec> {
    state?: AxisItemStateStyle<IRuleMarkSpec>;
}
export interface ITitle extends IAxisItem<ITextMarkSpec> {
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
    text?: string | string[];
    angle?: number;
    state?: AxisItemStateStyle<Partial<ITextMarkSpec>>;
}
export type StyleCallback<T> = (value: any, index: number, datum: Datum, data: Datum[]) => T;
export type AxisType = 'linear' | 'ordinal' | 'band' | 'point' | 'time' | 'log' | 'symlog';
export interface IAxisCommonTheme {
    grid?: IGrid;
    subGrid?: IGrid;
    domainLine?: IDomainLine;
    label?: ILabel;
    title?: ITitle;
    tick?: ITick;
    subTick?: ISubTick;
}
export interface IBandAxisTheme extends IAxisCommonTheme {
    bandPadding?: number | number[];
    paddingInner?: number | number[];
    paddingOuter?: number | number[];
}
