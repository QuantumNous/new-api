import type { IGraphic } from '@visactor/vrender-core';
import type { IMarkSpec } from '../../typings';
import type { IArcMarkSpec, IAreaMarkSpec, IBoxPlotMarkSpec, ICellMarkSpec, ICommonSpec, IComposedTextMarkSpec, IGroupMarkSpec, IImageMarkSpec, ILineMarkSpec, ILinkPathMarkSpec, IPathMarkSpec, IPolygonMarkSpec, IRectMarkSpec, IRippleMarkSpec, IRuleMarkSpec, ISymbolMarkSpec } from '../../typings/visual';
import type { IMark, IMarkRaw } from './common';
import type { MarkType } from './type';
export interface IComponentMark extends IMarkRaw<ICommonSpec> {
    getComponent: () => IGraphic;
    clearComponent: () => void;
    releaseWithExitAnimation: () => boolean;
    forceReleaseExitAnimation: () => void;
    setAttributeTransform: (t: (attrs: any) => any) => any;
}
export interface IGlyphMark<T extends ICommonSpec = ICommonSpec, C = any> extends IMarkRaw<T> {
    setGlyphConfig: (cfg: C) => void;
    getGlyphConfig: () => C;
    getSubMarks: () => Record<string, {
        type: MarkType;
        defaultAttributes?: any;
    }>;
    getPositionChannels: () => string[];
}
export interface ILabelMark extends ITextMark {
    skipEncode: boolean;
    getRule: () => string;
    setRule: (rule: string) => void;
    getTarget: () => IMark;
    setTarget: (target: IMark) => void;
    getComponent: () => IComponentMark;
    setComponent: (component: IComponentMark) => void;
}
export type ITextMark = IMarkRaw<IComposedTextMarkSpec> & {
    getTextType: () => 'text' | 'rich';
};
export type ITextSpec<T> = IMarkSpec<T> & {
    textType?: 'rich' | 'text';
};
export type IPolygonMark = IMarkRaw<IPolygonMarkSpec>;
export type IArcMark = IMarkRaw<IArcMarkSpec>;
export type IAreaMark = IMarkRaw<IAreaMarkSpec>;
export type IBoxPlotMark = IMarkRaw<IBoxPlotMarkSpec>;
export type ICellMark = IMarkRaw<ICellMarkSpec>;
export type IImageMark = IMarkRaw<IImageMarkSpec>;
export type ILineMark = IMarkRaw<ILineMarkSpec>;
export type ILinkPathMark = IMarkRaw<ILinkPathMarkSpec>;
export type IPathMark = IMarkRaw<IPathMarkSpec>;
export type IRectMark = IMarkRaw<IRectMarkSpec>;
export type IRippleMark = IMarkRaw<IRippleMarkSpec>;
export type IRuleMark = IMarkRaw<IRuleMarkSpec>;
export type ISymbolMark = IMarkRaw<ISymbolMarkSpec>;
export interface IGroupMark extends IMarkRaw<IGroupMarkSpec> {
    addMark: (m: IMark) => boolean;
    removeMark: (m: IMark) => boolean;
    getMarks: () => IMark[];
    getMarkInType: (type: MarkType) => IMark[];
    getMarkInId: (id: number) => IMark | undefined;
    getMarkInName: (name: string) => IMark[] | undefined;
}
export interface ILinkPathConfig {
    direction?: 'horizontal' | 'vertical' | 'LR' | 'RL' | 'TB' | 'BL' | 'radial';
}
