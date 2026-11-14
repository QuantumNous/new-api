import type { ILinkPathMarkSpec } from '../typings/visual';
import type { ILinkPathConfig, ILinkPathMark, IMarkStyle } from './interface';
import { MarkTypeEnum } from './interface/type';
import { GlyphMark } from './glyph';
import type { IGlyph } from '@visactor/vrender-core';
import type { Datum } from '../typings/common';
export declare const getHorizontalPath: (options: ILinkPathMarkSpec, ratio?: number) => string;
export declare const getVerticalPath: (options: ILinkPathMarkSpec, ratio?: number) => string;
export declare class LinkPathMark extends GlyphMark<ILinkPathMarkSpec, ILinkPathConfig> implements ILinkPathMark {
    static readonly type = MarkTypeEnum.linkPath;
    readonly type = MarkTypeEnum.linkPath;
    protected _getDefaultStyle(): IMarkStyle<ILinkPathMarkSpec>;
    protected _subMarks: {
        back: {
            type: string;
            defaultAttributes: {
                zIndex: number;
            };
        };
        front: {
            type: string;
            defaultAttributes: {
                zIndex: number;
            };
        };
    };
    protected _positionChannels: string[];
    protected _channelEncoder: {
        backgroundStyle: (val: any) => {
            back: any;
        };
    };
    protected _positionEncoder: (glyphAttrs: any, datum: Datum, g: IGlyph) => {
        back: {
            path: string;
        };
        front: {
            path: string;
        };
    };
}
export declare const registerLinkPathMark: () => void;
