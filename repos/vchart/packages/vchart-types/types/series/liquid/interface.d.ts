import type { IMarkSpec, IMarkTheme } from '../../typings/spec/common';
import type { ILiquidMarkSpec, IGroupMarkSpec, ILiquidOutlineSpec } from '../../typings/visual';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { IAnimationSpec } from '../../animation/spec';
import type { SymbolType } from '@visactor/vrender-core';
import type { ISymbolMark } from '../../mark/interface';
export interface ILiquidAnimationParams {
    height: {
        from: () => number | number;
        to: () => number | number;
    };
    dy: {
        from: () => number | number;
        to: () => number | number;
    };
}
export type LiquidAppearPreset = 'wave' | 'grow' | 'waveGrow';
type LiquidMarks = 'liquid';
export type LiquidShapeType = SymbolType | 'drop';
export type ILiquidPadding = {
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
};
export type ILiquidPaddingSpec = ILiquidPadding | number | number[];
export interface ILiquidSeriesSpec extends IAnimationSpec<LiquidMarks, LiquidAppearPreset> {
    type: 'liquid';
    valueField?: string;
    maskShape?: LiquidShapeType;
    outlineMargin?: ILiquidPaddingSpec;
    outlinePadding?: ILiquidPaddingSpec;
    indicatorSmartInvert?: boolean;
    reverse?: boolean;
    [SeriesMarkNameEnum.liquid]?: IMarkSpec<ILiquidMarkSpec>;
    [SeriesMarkNameEnum.liquidBackground]?: IMarkSpec<IGroupMarkSpec>;
    [SeriesMarkNameEnum.liquidOutline]?: IMarkSpec<ISymbolMark>;
}
export interface ILiquidSeriesTheme {
    outlineMargin?: ILiquidPaddingSpec;
    outlinePadding?: ILiquidPaddingSpec;
    [SeriesMarkNameEnum.liquid]?: Partial<IMarkTheme<ILiquidMarkSpec>>;
    [SeriesMarkNameEnum.liquidBackground]?: IMarkSpec<IGroupMarkSpec>;
    [SeriesMarkNameEnum.liquidOutline]?: IMarkSpec<ILiquidOutlineSpec>;
}
export {};
