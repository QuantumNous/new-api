import type { IMarkStyle } from './interface';
import { MarkTypeEnum } from './interface/type';
import type { ILiquidMark } from '../series/liquid/liquid';
import { GlyphMark } from './glyph';
import { type IGlyph } from '@visactor/vrender-core';
import type { IPointLike } from '@visactor/vutils';
import type { ILiquidMarkSpec } from '../typings/visual';
import type { Datum } from '../typings/common';
export declare class LiquidMark extends GlyphMark<ILiquidMarkSpec> implements ILiquidMark {
    static readonly type = MarkTypeEnum.liquid;
    readonly type = MarkTypeEnum.liquid;
    protected _getDefaultStyle(): IMarkStyle<ILiquidMarkSpec>;
    protected _subMarks: {
        wave0: {
            type: string;
            defaultAttributes: {
                curveType: string;
                fillOpacity: number;
            };
        };
        wave1: {
            type: string;
            defaultAttributes: {
                curveType: string;
                fillOpacity: number;
            };
        };
        wave2: {
            type: string;
            defaultAttributes: {
                curveType: string;
                fillOpacity: number;
            };
        };
    };
    protected _positionChannels: string[];
    protected _positionEncoder: (glyphAttrs: any, datum: Datum, g: IGlyph) => {
        wave0: {
            x: number;
            y: number;
            points: IPointLike[];
        };
        wave1: {
            x: number;
            y: number;
            points: IPointLike[];
        };
        wave2: {
            x: number;
            y: number;
            points: IPointLike[];
        };
    };
}
export declare const registerLiquidMark: () => void;
