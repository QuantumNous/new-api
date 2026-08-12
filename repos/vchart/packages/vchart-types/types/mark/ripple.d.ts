import type { IRippleMarkSpec } from '../typings/visual';
import type { IMarkStyle, IRippleMark } from './interface';
import { MarkTypeEnum } from './interface/type';
import { GlyphMark } from './glyph';
import type { Datum } from '../typings/common';
import { type IGlyph } from '@visactor/vrender-core';
export declare class RippleMark extends GlyphMark<IRippleMarkSpec> implements IRippleMark {
    static readonly type = MarkTypeEnum.ripple;
    readonly type = MarkTypeEnum.ripple;
    protected _getDefaultStyle(): IMarkStyle<IRippleMarkSpec>;
    protected _subMarks: {
        ripple0: {
            type: string;
            defaultAttributes: {
                fillOpacity: number;
            };
        };
        ripple1: {
            type: string;
            defaultAttributes: {
                fillOpacity: number;
            };
        };
        ripple2: {
            type: string;
            defaultAttributes: {
                fillOpacity: number;
            };
        };
    };
    protected _positionChannels: string[];
    protected _positionEncoder: (glyphAttrs: any, datum: Datum, g: IGlyph) => {
        ripple0: {
            size: any;
            fillOpacity: number;
        };
        ripple1: {
            size: any;
            fillOpacity: number;
        };
        ripple2: {
            size: any;
            fillOpacity: number;
        };
    };
}
export declare const registerRippleMark: () => void;
